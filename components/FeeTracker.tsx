import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { FeeMember, FeeStatus, FeeStatusEnum } from '../types';
import { supabase } from '../lib/supabaseClient';

// --- ICONS ---
const ChevronLeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>;
const ChevronRightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;

// --- HELPERS ---
const getMonthKey = (date: Date): string => date.toISOString().slice(0, 7) + '-01';

const STATUS_CONFIG = {
  [FeeStatusEnum.Paid]: { label: 'Paid', bgColor: 'bg-green-500/80', textColor: 'text-green-100', hoverBg: 'hover:bg-green-500' },
  [FeeStatusEnum.Unpaid]: { label: 'Unpaid', bgColor: 'bg-red-600/80', textColor: 'text-red-100', hoverBg: 'hover:bg-red-500' },
};

interface FeeTrackerProps {
  isAdmin: boolean;
}

export const FeeTracker: React.FC<FeeTrackerProps> = ({ isAdmin }) => {
    const [members, setMembers] = useState<FeeMember[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date(2025, 6, 1)); // Start at July 2025
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const monthKey = useMemo(() => getMonthKey(currentDate), [currentDate]);

    const fetchMembersAndFees = useCallback(async () => {
        setIsLoadingData(true);
        setError(null);
        const { data: membersData, error: membersError } = await supabase
            .from('members')
            .select('*')
            .order('id');

        if (membersError) {
            console.error("Error fetching members:", membersError);
            setError(`Failed to fetch members. This could be a network issue or a problem with database permissions (Row Level Security). Message: ${membersError.message}`);
            setIsLoadingData(false);
            return;
        }

        if (!membersData) {
          setMembers([]);
          setIsLoadingData(false);
          return;
        }

        const memberIds = membersData.map(m => m.id);
        const { data: feesData, error: feesError } = await supabase
          .from('fees')
          .select('member_id, status')
          .in('member_id', memberIds)
          .eq('month', monthKey);

        if (feesError) {
          console.error("Error fetching fees:", feesError);
          if (feesError.message.includes('relation "public.fees" does not exist')) {
            setError('Database error: The "fees" table does not exist. Please run the setup SQL script provided.');
          } else {
            setError(`Failed to fetch fee data. Please check Row Level Security policies on the 'fees' table. Message: ${feesError.message}`);
          }
        }

        const feesMap = new Map<number, FeeStatus>();
        feesData?.forEach(fee => feesMap.set(fee.member_id, fee.status));
        
        const combinedMembers: FeeMember[] = membersData.map(member => ({
            id: member.id,
            name: member.name,
            fees: {
                [monthKey]: feesMap.get(member.id) || FeeStatusEnum.Unpaid
            }
        }));

        setMembers(combinedMembers);
        setIsLoadingData(false);
    }, [monthKey]);

    useEffect(() => {
        fetchMembersAndFees();
    }, [fetchMembersAndFees]);

    const isFirstMonth = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        return year === 2025 && month === 6; // July is 6
    }, [currentDate]);

    const handleMonthChange = useCallback((offset: number) => {
        setCurrentDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    }, []);
    
    const handleToggleFeeStatus = useCallback(async (memberId: number) => {
        if (!isAdmin) return;
        const member = members.find(m => m.id === memberId);
        if (!member) return;

        const currentStatus = member.fees[monthKey] || FeeStatusEnum.Unpaid;
        const newStatus = currentStatus === FeeStatusEnum.Paid ? FeeStatusEnum.Unpaid : FeeStatusEnum.Paid;
        
        setMembers(prevMembers =>
            prevMembers.map(m => m.id === memberId ? { ...m, fees: { ...m.fees, [monthKey]: newStatus } } : m)
        );

        const { error } = await supabase.from('fees').upsert({
            member_id: memberId,
            month: monthKey,
            status: newStatus,
        }, { onConflict: 'member_id,month' });
        
        if (error) {
            console.error("Error saving fee status:", error.message);
            setError(`Failed to save fee status. Reverting changes. Message: ${error.message}`);
            fetchMembersAndFees(); // Revert on error
        }
    }, [members, isAdmin, monthKey, fetchMembersAndFees]);

    const feeTotals = useMemo(() => {
        return members.reduce((acc, member) => {
            if (member.fees[monthKey] === FeeStatusEnum.Paid) {
                acc.paid += 1;
            } else {
                acc.unpaid += 1;
            }
            return acc;
        }, { paid: 0, unpaid: 0 });
    }, [members, monthKey]);
    
    const ErrorDisplay = () => (
      <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg my-4" role="alert">
        <strong className="font-bold">An error occurred:</strong>
        <span className="block sm:inline ml-2">{error}</span>
      </div>
    );

    if (isLoadingData) {
      return (
        <div className="flex justify-center items-center h-96 bg-slate-800 text-white rounded-xl">
          <p>Loading fee data...</p>
        </div>
      );
    }

    return (
      <div className="bg-slate-800 rounded-xl shadow-2xl overflow-hidden ring-1 ring-slate-700">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Previous month" disabled={isFirstMonth}>
              <ChevronLeftIcon />
            </button>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-wide">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
            <button onClick={() => handleMonthChange(1)} className="p-2 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" aria-label="Next month">
              <ChevronRightIcon />
            </button>
          </div>
          
          {error && <ErrorDisplay />}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="sticky left-0 bg-slate-800 p-4 text-sm font-semibold text-slate-300 uppercase tracking-wider">
                    <div className="flex items-center">
                      <span>Member</span>
                      <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-medium text-indigo-100">
                        {members.length}
                      </span>
                    </div>
                  </th>
                  <th className="p-4 text-sm font-semibold text-slate-300 uppercase tracking-wider text-center">
                    Fee Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {members.map(member => {
                    const status = member.fees[monthKey] || FeeStatusEnum.Unpaid;
                    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG[FeeStatusEnum.Unpaid];
                    return (
                      <tr key={member.id} className="hover:bg-slate-700/50 transition-colors">
                        <td className="sticky left-0 bg-slate-800 p-4 font-medium text-slate-100 whitespace-nowrap">
                            {member.name}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleToggleFeeStatus(member.id)}
                            className={`w-24 h-10 rounded-md flex items-center justify-center mx-auto font-semibold text-base transition-all transform hover:scale-105 ${config.bgColor} ${config.textColor} ${config.hoverBg}`}
                            aria-label={`Toggle fee status for ${member.name}`}
                            disabled={!isAdmin}
                          >
                            {config.label}
                          </button>
                        </td>
                      </tr>
                    );
                })}
              </tbody>
               <tfoot className="border-t-2 border-slate-600 bg-slate-900/70">
                <tr>
                  <td className="sticky left-0 bg-slate-900/70 p-4 text-sm font-semibold text-slate-300 uppercase tracking-wider">Total</td>
                  <td className="p-4 text-center font-bold text-slate-100 text-base">
                    <span className="text-green-400">{feeTotals.paid} Paid</span>
                    <span className="mx-2 text-slate-500">/</span>
                    <span className="text-red-400">{feeTotals.unpaid} Unpaid</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
};