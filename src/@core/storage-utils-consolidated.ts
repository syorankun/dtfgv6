/**
 * DJ DataForge v6 - Storage & Utils Consolidated Module
 *
 * FUTURE SPLIT POINTS:
 * - storage/persistence.ts (PersistenceManager class)
 * - storage/snapshot.ts (Snapshot utilities)
 * - storage/recovery.ts (Crash recovery)
 * - utils/logger.ts (Logger class)
 * - utils/assert.ts (Assertions)
 * - utils/formatters.ts (Number/Date formatting)
 *
 * Combined for now to reduce artifact count during initial development.
 */

import { openDB, IDBPDatabase } from "idb";
import type { LogLevel, LogEntry } from "./types";

// ============================================================================
// LOGGER
// ============================================================================

export class Logger {
  private history: LogEntry[] = [];
  private maxHistory = 1000;
  private level: LogLevel = "info";
  private toConsole = true;

  constructor(options?: {
    level?: LogLevel;
    toConsole?: boolean;
    maxHistory?: number;
  }) {
    this.level = options?.level || "info";
    this.toConsole = options?.toConsole ?? true;
    this.maxHistory = options?.maxHistory || 1000;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, data?: any, source: string = "[DJ]"): void {
    this.log("debug", source, message, data);
  }

  info(message: string, data?: any, source: string = "[DJ]"): void {
    this.log("info", source, message, data);
  }

  warn(message: string, data?: any, source: string = "[DJ]"): void {
    this.log("warn", source, message, data);
  }

  error(message: string, data?: any, source: string = "[DJ]"): void {
    this.log("error", source, message, data);
  }

  private log(
    level: LogLevel,
    source: string,
    message: string,
    data?: any
  ): void {
    const levelPriority: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    if (levelPriority[level] < levelPriority[this.level]) {
      return;
    }

    const entry: LogEntry = {
      level,
      timestamp: new Date(),
      source,
      message,
      data,
    };

    this.history.push(entry);

    // Trim history
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Console output
    if (this.toConsole) {
      const method =
        level === "error" ? "error" : level === "warn" ? "warn" : "log";
      console[method](`${source} ${message}`, data || "");
    }
  }

  getHistory(filter?: { level?: LogLevel; source?: string }): LogEntry[] {
    let result = this.history;

    if (filter?.level) {
      result = result.filter((e) => e.level === filter.level);
    }

    if (filter?.source) {
      result = result.filter((e) => e.source === filter.source);
    }

    return result;
  }

  clearHistory(): void {
    this.history = [];
  }
}

// Global logger instance
export const logger = new Logger({ level: "info", toConsole: true });

// ============================================================================
// PERSISTENCE MANAGER (IndexedDB)
// ============================================================================

const DB_NAME = "DJ_DataForge_v6";
const DB_VERSION = 1;

export class PersistenceManager {
  private db?: IDBPDatabase;
  private logger = logger;

  async init(): Promise<void> {
    try {
      this.db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Companies store
          if (!db.objectStoreNames.contains("companies")) {
            db.createObjectStore("companies", { keyPath: "id" });
          }

          // Workbooks store
          if (!db.objectStoreNames.contains("workbooks")) {
            const workbookStore = db.createObjectStore("workbooks", {
              keyPath: "id",
            });
            workbookStore.createIndex("companyId", "companyId", {
              unique: false,
            });
          }

          // Snapshots store (for recovery)
          if (!db.objectStoreNames.contains("snapshots")) {
            db.createObjectStore("snapshots", { keyPath: "timestamp" });
          }

          // Plugin settings store
          if (!db.objectStoreNames.contains("plugin_settings")) {
            db.createObjectStore("plugin_settings", { keyPath: "pluginId" });
          }

          // Plugin data store (isolated per plugin)
          if (!db.objectStoreNames.contains("plugin_data")) {
            const pluginDataStore = db.createObjectStore("plugin_data", {
              keyPath: ["pluginId", "key"],
            });
            pluginDataStore.createIndex("pluginId", "pluginId", {
              unique: false,
            });
          }

          // Settings store
          if (!db.objectStoreNames.contains("settings")) {
            db.createObjectStore("settings", { keyPath: "key" });
          }
        },
      });

      this.logger.info("[Persistence] IndexedDB initialized");
    } catch (error) {
      this.logger.error("[Persistence] Init failed", error);
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // WORKBOOK OPERATIONS
  // --------------------------------------------------------------------------

  async saveWorkbook(workbook: any): Promise<void> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      const serialized = workbook.serialize();
      await this.db.put("workbooks", serialized);
      this.logger.debug("[Persistence] Workbook saved", { id: workbook.id });
    } catch (error) {
      this.logger.error("[Persistence] Workbook save failed", error);
      throw error;
    }
  }

  async getWorkbook(id: string): Promise<any | null> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      const data = await this.db.get("workbooks", id);
      return data || null;
    } catch (error) {
      this.logger.error("[Persistence] Workbook get failed", error);
      return null;
    }
  }

  async deleteWorkbook(id: string): Promise<void> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      await this.db.delete("workbooks", id);
      this.logger.debug("[Persistence] Workbook deleted", { id });
    } catch (error) {
      this.logger.error("[Persistence] Workbook delete failed", error);
      throw error;
    }
  }

  async getAllWorkbooks(companyId?: string): Promise<any[]> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      if (companyId) {
        return await this.db.getAllFromIndex(
          "workbooks",
          "companyId",
          companyId
        );
      }
      return await this.db.getAll("workbooks");
    } catch (error) {
      this.logger.error("[Persistence] Get all workbooks failed", error);
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // COMPANY OPERATIONS
  // --------------------------------------------------------------------------

  async saveCompany(company: any): Promise<void> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      await this.db.put("companies", company);
      this.logger.debug("[Persistence] Company saved", { id: company.id });
    } catch (error) {
      this.logger.error("[Persistence] Company save failed", error);
      throw error;
    }
  }

  async getCompany(id: string): Promise<any | null> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      const data = await this.db.get("companies", id);
      return data || null;
    } catch (error) {
      this.logger.error("[Persistence] Company get failed", error);
      return null;
    }
  }

  async getAllCompanies(): Promise<any[]> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      return await this.db.getAll("companies");
    } catch (error) {
      this.logger.error("[Persistence] Get all companies failed", error);
      return [];
    }
  }

  async deleteCompany(id: string): Promise<void> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      // Delete company
      await this.db.delete("companies", id);

      // Delete all workbooks for this company
      const workbooks = await this.getAllWorkbooks(id);
      for (const wb of workbooks) {
        await this.deleteWorkbook(wb.id);
      }

      this.logger.debug("[Persistence] Company deleted", { id });
    } catch (error) {
      this.logger.error("[Persistence] Company delete failed", error);
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // SNAPSHOT OPERATIONS (for recovery)
  // --------------------------------------------------------------------------

  async saveSnapshot(data: any): Promise<void> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      const snapshot = {
        timestamp: Date.now(),
        data,
      };

      await this.db.put("snapshots", snapshot);

      // Keep only last 10 snapshots
      const allSnapshots = await this.db.getAll("snapshots");
      if (allSnapshots.length > 10) {
        const toDelete = allSnapshots
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(0, allSnapshots.length - 10);

        for (const snap of toDelete) {
          await this.db.delete("snapshots", snap.timestamp);
        }
      }

      this.logger.debug("[Persistence] Snapshot saved");
    } catch (error) {
      this.logger.error("[Persistence] Snapshot save failed", error);
    }
  }

  async getLastSnapshot(): Promise<any | null> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      const allSnapshots = await this.db.getAll("snapshots");
      if (allSnapshots.length === 0) return null;

      const latest = allSnapshots.sort((a, b) => b.timestamp - a.timestamp)[0];
      return latest.data;
    } catch (error) {
      this.logger.error("[Persistence] Get snapshot failed", error);
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // SETTINGS OPERATIONS
  // --------------------------------------------------------------------------

  async saveSetting(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      await this.db.put("settings", { key, value });
    } catch (error) {
      this.logger.error("[Persistence] Setting save failed", error);
    }
  }

  async getSetting(key: string, defaultValue?: any): Promise<any> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      const data = await this.db.get("settings", key);
      return data?.value ?? defaultValue;
    } catch (error) {
      this.logger.error("[Persistence] Setting get failed", error);
      return defaultValue;
    }
  }

  // --------------------------------------------------------------------------
  // PLUGIN STORAGE OPERATIONS
  // --------------------------------------------------------------------------

  async savePluginData(
    pluginId: string,
    key: string,
    value: any
  ): Promise<void> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      await this.db.put("plugin_data", { pluginId, key, value });
    } catch (error) {
      this.logger.error("[Persistence] Plugin data save failed", error);
      throw error;
    }
  }

  async getPluginData(pluginId: string, key: string): Promise<any> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      const data = await this.db.get("plugin_data", [pluginId, key]);
      return data?.value;
    } catch (error) {
      this.logger.error("[Persistence] Plugin data get failed", error);
      return undefined;
    }
  }

  async deletePluginData(pluginId: string, key: string): Promise<void> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      await this.db.delete("plugin_data", [pluginId, key]);
    } catch (error) {
      this.logger.error("[Persistence] Plugin data delete failed", error);
    }
  }

  async clearPluginData(pluginId: string): Promise<void> {
    if (!this.db) throw new Error("DB not initialized");

    try {
      const allData = await this.db.getAllFromIndex(
        "plugin_data",
        "pluginId",
        pluginId
      );
      for (const item of allData) {
        await this.db.delete("plugin_data", [item.pluginId, item.key]);
      }
      this.logger.debug("[Persistence] Plugin data cleared", { pluginId });
    } catch (error) {
      this.logger.error("[Persistence] Plugin data clear failed", error);
    }
  }

  async getPluginRefs(): Promise<any[]> {
    const refs = await this.getSetting("plugin_refs", []);
    return refs;
  }

  async savePluginRefs(refs: any[]): Promise<void> {
    await this.saveSetting("plugin_refs", refs);
  }
}

// ============================================================================
// FORMATTERS
// ============================================================================

export class Formatters {
  /**
   * Format number with locale
   */
  static formatNumber(
    value: number,
    options?: {
      decimals?: number;
      locale?: string;
      currency?: string;
    }
  ): string {
    const locale = options?.locale || "pt-BR";
    const decimals = options?.decimals ?? 2;

    if (options?.currency) {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: options.currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    }

    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  /**
   * Format date with locale
   */
  static formatDate(
    date: Date,
    options?: {
      format?: "short" | "medium" | "long" | "full";
      locale?: string;
    }
  ): string {
    const locale = options?.locale || "pt-BR";
    const format = options?.format || "medium";

    const formatMap: Record<string, Intl.DateTimeFormatOptions> = {
      short: { year: "numeric", month: "2-digit", day: "2-digit" },
      medium: { year: "numeric", month: "short", day: "2-digit" },
      long: { year: "numeric", month: "long", day: "2-digit" },
      full: {
        year: "numeric",
        month: "long",
        day: "2-digit",
        weekday: "long",
      },
    };

    return new Intl.DateTimeFormat(locale, formatMap[format]).format(date);
  }

  /**
   * Parse number from string
   */
  static parseNumber(value: string, locale: string = "pt-BR"): number | null {
    // Remove grouping separators
    let cleaned = value.trim();

    if (locale === "pt-BR") {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Format bytes
   */
  static formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${
      sizes[i]
    }`;
  }

  /**
   * Format duration (milliseconds to human readable)
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000)
      return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;

    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }
}

// ============================================================================
// ASSERTIONS
// ============================================================================

export class Assert {
  /**
   * Assert value is not null/undefined
   */
  static notNull<T>(
    value: T | null | undefined,
    message?: string
  ): asserts value is T {
    if (value === null || value === undefined) {
      throw new Error(message || "Value is null or undefined");
    }
  }

  /**
   * Assert condition is true
   */
  static isTrue(condition: boolean, message?: string): asserts condition {
    if (!condition) {
      throw new Error(message || "Assertion failed");
    }
  }

  /**
   * Assert value is valid cell coordinate
   */
  static isValidCoord(row: number, col: number): void {
    if (row < 0 || col < 0) {
      throw new Error(`Invalid coordinate: [${row}, ${col}]`);
    }
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      throw new Error(`Coordinate must be integer: [${row}, ${col}]`);
    }
  }

  /**
   * Assert array is not empty
   */
  static notEmpty<T>(arr: T[], message?: string): asserts arr is [T, ...T[]] {
    if (arr.length === 0) {
      throw new Error(message || "Array is empty");
    }
  }

  /**
   * Assert value is in range
   */
  static inRange(
    value: number,
    min: number,
    max: number,
    message?: string
  ): void {
    if (value < min || value > max) {
      throw new Error(
        message || `Value ${value} not in range [${min}, ${max}]`
      );
    }
  }
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

export class Perf {
  private static marks: Map<string, number> = new Map();

  /**
   * Start performance measurement
   */
  static start(label: string): void {
    this.marks.set(label, performance.now());
  }

  /**
   * End performance measurement and return duration
   */
  static end(label: string): number {
    const start = this.marks.get(label);
    if (!start) {
      logger.warn(`[Perf] No mark found for: ${label}`);
      return 0;
    }

    const duration = performance.now() - start;
    this.marks.delete(label);

    logger.debug(`[Perf] ${label}: ${Formatters.formatDuration(duration)}`);
    return duration;
  }

  /**
   * Measure async function
   */
  static async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      return await fn();
    } finally {
      this.end(label);
    }
  }
}
