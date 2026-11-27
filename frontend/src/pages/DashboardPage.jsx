import { useEffect, useState } from 'react';
import { Download, FileText, RefreshCcw } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { apiClient } from '../api/client.js';
import AttendanceTable from '../components/AttendanceTable.jsx';
import StatCard from '../components/StatCard.jsx';
import AttendanceTrendChart from '../components/charts/AttendanceTrendChart.jsx';
import TopStudentsChart from '../components/charts/TopStudentsChart.jsx';
import { downloadBlob, getFileNameFromHeaders } from '../utils/download.js';

const DashboardPage = () => {
  const [analytics, setAnalytics] = useState({
    summary: {
      totalStudents: 0,
      todayCount: 0,
      absentCount: 0,
      totalAttendanceRecords: 0,
      attendanceRate: 0
    },
    weeklyTrend: [],
    topStudents: []
  });
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    date: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  const loadDashboard = async () => {
    const [{ data: students, error: studentsError }, { data: rows, error: rowsError }] = await Promise.all([
      supabase.from('students').select('*').eq('status', 'active'),
      supabase.from('attendance').select('*, students(*)').order('attended_at', { ascending: false })
    ]);
    if (studentsError || rowsError) throw studentsError || rowsError;
    const today = new Date().toISOString().slice(0, 10);
    const allRecords = (rows || []).map((row) => ({ ...row, _id: row.id, name: row.students?.name, studentCode: row.students?.student_code, dateKey: row.date_key, attendedAt: row.attended_at }));
    const filtered = allRecords.filter((record) => (!filters.date || record.dateKey === filters.date) && (!filters.search || `${record.name} ${record.studentCode}`.toLowerCase().includes(filters.search.toLowerCase())));
    const dates = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return date.toISOString().slice(0, 10); });
    const counts = new Map(allRecords.map((record) => [record.dateKey, (allRecords.filter((entry) => entry.dateKey === record.dateKey).length)]));
    const byStudent = Object.values(allRecords.reduce((result, record) => { const key = record.student_id; result[key] ||= { name: record.name, studentCode: record.studentCode, count: 0 }; result[key].count += 1; return result; }, {})).sort((a, b) => b.count - a.count).slice(0, 5);
    const todayCount = allRecords.filter((record) => record.dateKey === today).length;
    setRecords(filtered);
    setAnalytics({ summary: { totalStudents: students?.length || 0, todayCount, absentCount: Math.max((students?.length || 0) - todayCount, 0), totalAttendanceRecords: allRecords.length, attendanceRate: students?.length ? Number(((todayCount / students.length) * 100).toFixed(2)) : 0 }, weeklyTrend: dates.map((dateKey) => ({ dateKey, count: counts.get(dateKey) || 0 })), topStudents: byStudent });
  };

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        await loadDashboard();
      } catch (requestError) {
        if (!ignore) {
          setError(requestError.response?.data?.message || 'Unable to load dashboard data.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, [filters.date, filters.search]);

  const exportReport = async (type) => {
    try {
      setExporting(type);
      const response = await apiClient.get(`/attendance/export/${type}`, {
        params: {
          search: filters.search,
          date: filters.date
        },
        responseType: 'blob'
      });

      downloadBlob(response.data, getFileNameFromHeaders(response.headers, `attendance.${type}`));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to export the requested report.');
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="space-y-4">
      <section className="surface-panel overflow-hidden">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">Overview</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Good morning.</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Here’s today’s attendance at a glance.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="soft-button rounded-2xl border border-slate-200 bg-white/80 text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
            >
              <RefreshCcw className="size-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => exportReport('csv')}
              disabled={exporting === 'csv'}
              className="soft-button rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300"
            >
              <Download className="size-4" />
              {exporting === 'csv' ? 'Exporting CSV...' : 'Export CSV'}
            </button>
            <button
              type="button"
              onClick={() => exportReport('pdf')}
              disabled={exporting === 'pdf'}
              className="soft-button rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
            >
              <FileText className="size-4" />
              {exporting === 'pdf' ? 'Exporting PDF...' : 'Export PDF'}
            </button>
          </div>
        </div>

        {error ? <p className="mt-5 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Present" value={analytics.summary.todayCount} hint="Checked in today" accent="sky" />
        <StatCard label="Students" value={analytics.summary.totalStudents} hint="Active roster" accent="emerald" />
        <StatCard label="Remaining" value={analytics.summary.absentCount} hint="Not checked in" accent="amber" />
        <StatCard label="Attendance rate" value={`${analytics.summary.attendanceRate}%`} hint="Today’s completion rate across active profiles." accent="violet" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <AttendanceTrendChart dataPoints={analytics.weeklyTrend} />
        <TopStudentsChart dataPoints={analytics.topStudents} />
      </section>

      <AttendanceTable
        records={records}
        search={filters.search}
        date={filters.date}
        onSearchChange={(value) => setFilters((current) => ({ ...current, search: value }))}
        onDateChange={(value) => setFilters((current) => ({ ...current, date: value }))}
        emptyMessage={loading ? 'Loading records...' : 'No attendance records match the current filters.'}
      />
    </div>
  );
};

export default DashboardPage;
