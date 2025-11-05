/**
 * Loan Plugin Entry Point
 *
 * Plugin de Gestão de Empréstimos para DJ DataForge v6
 */

export { LoanPlugin } from './loan-plugin';
export * from './loan-types';
export { LoanCalculator } from './loan-calculator';
export { INTEREST_TEMPLATES } from './loan-templates';
export { LoanScheduler, type AccrualRow, type ScheduleRow } from './loan-scheduler';
export { LoanFXIntegration } from './loan-fx-integration';
export { LoanValidator } from './loan-validator';
export { LoanPaymentManager, type LoanPayment } from './loan-payment-manager';
export { LoanDashboard } from './loan-dashboard';
