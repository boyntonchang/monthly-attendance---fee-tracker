import { Database } from './lib/database.types';

export type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];
export type FeeStatus = Database["public"]["Enums"]["fee_status"];

export const AttendanceStatusEnum = {
  Present: 'Present',
  Pending: 'Pending',
} as const;

export const FeeStatusEnum = {
  Paid: 'paid',
  Unpaid: 'unpaid',
} as const;


export type AttendanceRecord = {
  [date: string]: AttendanceStatus;
};

export type FeeRecord = {
  [month: string]: FeeStatus;
};

export interface MemberBase {
  id: number;
  name: string;
}

export interface AttendanceMember extends MemberBase {
  attendance: AttendanceRecord;
}

export interface FeeMember extends MemberBase {
  fees: FeeRecord;
}