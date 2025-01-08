// src/common/enums/loan-status.enum.ts
export enum LoanStatus {
  PENDING = 'PENDING', // Đang chờ xử lý
  APPROVED = 'APPROVED', // Đã phê duyệt
  REJECTED = 'REJECTED', // Đã từ chối
  DISBURSED = 'DISBURSED', // Đã giải ngân
  COMPLETED = 'COMPLETED', // Đã hoàn thành
  DEFAULTED = 'DEFAULTED', // Vỡ nợ
}
