import React, { useState, useMemo, useCallback, FormEvent, useEffect } from 'react';
import { AttendanceMember, AttendanceStatus, AttendanceStatusEnum } from '../types';
import { supabase } from '../lib/supabaseClient';
import { ConfirmationModal } from './ConfirmationModal';

// --- ICONS ---
const ChevronLeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>;
const ChevronRightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;

// --- HELPERS ---
const formatDateKey = (date: Date): string => date.toISOString().split('T')[0];

const STATUS_CONFIG = {
  [AttendanceStatusEnum.Present]: { label: 'P', bgColor: 'bg-green-500/80', textColor: 'text-green-100', hoverBg: 'hover:bg-green-500' },
  [AttendanceStatusEnum.Pending]: { label: '--', bgColor: 'bg-slate-600/80', textColor: 'text-slate-300', hoverBg: 'hover:bg-slate-500' },
};

interface AttendanceTrackerProps {
  isAdmin: boolean;
}

export const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({ isAdmin }) => {
    const [members, setMembers] = useState<AttendanceMember[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
    const [editingMemberName, setEditingMemberName] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState<number | null>(null);
    

    const fetchMembers = useCallback(async () => {
      setIsLoadingData(true);
      setError(null);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDayOfMonth = formatDateKey(new Date(year, month, 1));
      const lastDayOfMonth = formatDateKey(new Date(year, month + 1, 0));

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
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('member_id, date, status')
        .in('member_id', memberIds)
        .gte('date', firstDayOfMonth)
        .lte('date', lastDayOfMonth);

      if (attendanceError) {
        console.error("Error fetching attendance:", attendanceError);
        setError(`Failed to fetch attendance data. Please check Row Level Security policies on the 'attendance' table. Message: ${attendanceError.message}`);
      }

      const attendanceByMemberId = new Map<number, { [date: string]: AttendanceStatus }>();
      attendanceData?.forEach(att => {
        if (!attendanceByMemberId.has(att.member_id)) {
          attendanceByMemberId.set(att.member_id, {});
        }
        attendanceByMemberId.get(att.member_id)![att.date] = att.status;
      });

      const combinedMembers: AttendanceMember[] = membersData.map(member => ({
        id: member.id,
        name: member.name,
        attendance: attendanceByMemberId.get(member.id) || {},
      }));

      setMembers(combinedMembers);
      setIsLoadingData(false);
    }, [currentDate]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);


    

    const thursdaysInMonth = useMemo(() => {
        const dates: Date[] = [];
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const date = new Date(year, month, 1);
        
        while (date.getMonth() === month) {
            if (date.getDay() === 4) { // 4 is Thursday
                dates.push(new Date(date));
            }
            date.setDate(date.getDate() + 1);
        }
        return dates;
    }, [currentDate]);

    const attendanceTotals = useMemo(() => {
        return thursdaysInMonth.map(date => {
            const dateKey = formatDateKey(date);
            return members.reduce((total, member) => {
                if (member.attendance[dateKey] === AttendanceStatusEnum.Present) {
                    return total + 1;
                }
                return total;
            }, 0);
        });
    }, [members, thursdaysInMonth]);

    const handleMonthChange = useCallback((offset: number) => {
        setCurrentDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    }, []);

    const handleToggleAttendance = useCallback(async (memberId: number, date: Date) => {
        if (!isAdmin) return;
        const dateKey = formatDateKey(date);

        const member = members.find(m => m.id === memberId);
        if (!member) return;

        const currentStatus = member.attendance[dateKey] || AttendanceStatusEnum.Pending;
        const newStatus = currentStatus === AttendanceStatusEnum.Present ? AttendanceStatusEnum.Pending : AttendanceStatusEnum.Present;

        setMembers(prevMembers =>
            prevMembers.map(m => m.id === memberId ? { ...m, attendance: { ...m.attendance, [dateKey]: newStatus } } : m)
        );

        const { error } = await supabase.from('attendance').upsert({
            member_id: memberId,
            date: dateKey,
            status: newStatus,
        }, { onConflict: 'member_id,date' });

        if (error) {
            console.error("Error saving attendance:", error.message);
            setError(`Failed to save attendance. Reverting changes. Message: ${error.message}`);
            fetchMembers(); // Revert on error
        }
    }, [members, fetchMembers, isAdmin]);
    
    const handleAddMember = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        const name = newMemberName.trim();
        if (name === '' || !isAdmin) return;

        const { data, error } = await supabase.from('members').insert({ name }).select().single();
        if (error) {
          console.error('Error adding member:', error.message);
          setError(`Failed to add member. Message: ${error.message}`);
        } else if (data) {
          const newMember: AttendanceMember = { id: data.id, name: data.name, attendance: {} };
          setMembers(prev => [...prev, newMember].sort((a,b) => a.id - b.id));
          setNewMemberName('');
          setIsAddingMember(false);
        }
    }, [newMemberName, isAdmin]);

    const handleStartEdit = (member: AttendanceMember) => {
      if (!isAdmin) return;
      setEditingMemberId(member.id);
      setEditingMemberName(member.name);
    };

    const handleCancelEdit = () => {
      setEditingMemberId(null);
      setEditingMemberName('');
    };

    const handleSaveName = async (memberId: number) => {
      if (!isAdmin) return;
      const newName = editingMemberName.trim();
      if (newName === '') return;

      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, name: newName } : m));
      setEditingMemberId(null);
      setEditingMemberName('');

      const { error } = await supabase.from('members').update({ name: newName }).eq('id', memberId);
      if (error) {
        console.error("Error updating member name:", error.message);
        setError(`Failed to update name. Reverting. Message: ${error.message}`);
        fetchMembers(); // Revert on error
      }
    };

    const handleDeleteMember = (memberId: number) => {
        if (!isAdmin) return;
        setMemberToDelete(memberId);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteMember = useCallback(async () => {
        if (!memberToDelete) return;

        try {
            // Delete attendance
            const { error: attendanceError } = await supabase.from('attendance').delete().eq('member_id', memberToDelete);
            if (attendanceError) throw attendanceError;

            // Delete fees
            const { error: feesError } = await supabase.from('fees').delete().eq('member_id', memberToDelete);
            if (feesError) throw feesError;

            // Delete member
            const { error: memberError } = await supabase.from('members').delete().eq('id', memberToDelete);
            if (memberError) throw memberError;

            setMembers(prevMembers => prevMembers.filter(m => m.id !== memberToDelete));

        } catch (error: any) {
            console.error("Error deleting member:", error.message);
            setError(`Failed to delete member. Message: ${error.message}`);
        }
        setIsDeleteModalOpen(false);
        setMemberToDelete(null);
    }, [memberToDelete, fetchMembers]);

    const ErrorDisplay = () => (
      <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg my-4" role="alert">
        <strong className="font-bold">An error occurred:</strong>
        <span className="block sm:inline ml-2">{error}</span>
      </div>
    );

    if (isLoadingData) {
      return (
        <div className="flex justify-center items-center h-96 bg-slate-800 text-white rounded-xl">
          <p>Loading attendance data...</p>
        </div>
      );
    }
    
    return (
      <div className="bg-slate-800 rounded-xl shadow-2xl overflow-hidden ring-1 ring-slate-700">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" aria-label="Previous month">
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
                  {thursdaysInMonth.map(date => (
                    <th key={date.toISOString()} className="p-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-semibold text-slate-400 uppercase">{date.toLocaleString('en-US', { weekday: 'short' })}</span>
                        <span className="text-2xl font-bold text-slate-100">{date.getDate()}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {members.map(member => (
                  <tr key={member.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="sticky left-0 bg-slate-800 p-4 font-medium text-slate-100 whitespace-nowrap">
                       <div className="flex items-center justify-between">
                           {editingMemberId === member.id && isAdmin ? (
                              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); handleSaveName(member.id); }}>
                                <input
                                  type="text"
                                  value={editingMemberName}
                                  onChange={(e) => setEditingMemberName(e.target.value)}
                                  className="bg-slate-900 border border-slate-600 rounded-md px-2 py-1 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  autoFocus
                                  onBlur={() => handleSaveName(member.id)}
                                />
                              </form>
                            ) : (
                              <span onDoubleClick={() => handleStartEdit(member)} className={isAdmin ? 'cursor-pointer hover:text-indigo-400' : ''}>
                                {member.name}
                              </span>
                            )}
                            {isAdmin && (
                                <button onClick={() => handleDeleteMember(member.id)} className="text-slate-500 hover:text-red-500 ml-2">
                                    <TrashIcon />
                                </button>
                            )}
                        </div>
                    </td>
                    {thursdaysInMonth.map(date => {
                      const dateKey = formatDateKey(date);
                      const status = member.attendance[dateKey] || AttendanceStatusEnum.Pending;
                      const config = STATUS_CONFIG[status] ?? STATUS_CONFIG[AttendanceStatusEnum.Pending];
                      return (
                        <td key={dateKey} className="p-4 text-center">
                          <button
                            onClick={() => handleToggleAttendance(member.id, date)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto font-bold text-lg transition-all transform hover:scale-110 ${config.bgColor} ${config.textColor} ${config.hoverBg}`}
                            aria-label={`Toggle attendance for ${member.name} on ${date.toDateString()}`}
                            disabled={!isAdmin}
                          >
                            {config.label}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
               <tfoot className="border-t-2 border-slate-600 bg-slate-900/70">
                <tr>
                  <td className="sticky left-0 bg-slate-900/70 p-4 text-sm font-semibold text-slate-300 uppercase tracking-wider">Total</td>
                  {attendanceTotals.map((total, index) => (
                    <td key={`total-${index}`} className="p-4 text-center font-bold text-slate-100 text-lg">{total}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
            {isAdmin && (
              <>
                {!isAddingMember ? (
                    <div className="mt-6 flex justify-start">
                        <button onClick={() => setIsAddingMember(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md font-semibold hover:bg-indigo-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500">
                            <PlusIcon /> Add New Member
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleAddMember} className="mt-6 p-4 bg-slate-700/50 rounded-lg flex items-center gap-4">
                        <input type="text" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Enter member's name" className="flex-grow bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
                        <button type="submit" disabled={!newMemberName.trim()} className="px-4 py-2 bg-green-600 text-white rounded-md font-semibold hover:bg-green-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors">Save</button>
                        <button type="button" onClick={() => { setIsAddingMember(false); setNewMemberName(''); }} className="px-4 py-2 bg-slate-600 text-white rounded-md font-semibold hover:bg-slate-500 transition-colors">Cancel</button>
                    </form>
                )}
              </>
            )}
        </div>
        <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={confirmDeleteMember}
            title="Confirm Deletion"
            message="Are you sure you want to delete this member? This action cannot be undone."
        />
      </div>
    );
};