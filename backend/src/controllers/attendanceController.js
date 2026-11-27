import PDFDocument from 'pdfkit';
import { Parser } from 'json2csv';
import Attendance from '../models/Attendance.js';
import Student from '../models/Student.js';
import { getSocket } from '../config/socket.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getDateKey, getRecentDateKeys } from '../utils/date.js';
import { saveSnapshotFromDataUrl } from '../utils/fileUtils.js';
import { serializeAttendance } from '../utils/serializers.js';

const buildAttendanceFilter = ({ search = '', date = '', from = '', to = '' }) => {
  const query = {};

  if (search.trim()) {
    const pattern = new RegExp(search.trim(), 'i');
    query.$or = [{ name: pattern }, { studentCode: pattern }];
  }

  if (date) {
    query.dateKey = date;
  } else if (from || to) {
    query.dateKey = {};

    if (from) {
      query.dateKey.$gte = from;
    }

    if (to) {
      query.dateKey.$lte = to;
    }
  }

  return query;
};

export const markAttendance = asyncHandler(async (req, res) => {
  const { studentId, confidence = 0, distance = 0, threshold = 0.45, snapshotDataUrl = '', facesDetected = 1 } =
    req.body;

  if (!studentId) {
    return res.status(400).json({ message: 'studentId is required.' });
  }

  const student = await Student.findById(studentId);

  if (!student || student.status !== 'active') {
    return res.status(404).json({ message: 'Active student not found.' });
  }

  const dateKey = getDateKey();
  const existingAttendance = await Attendance.findOne({ student: student._id, dateKey }).populate(
    'student',
    'name studentCode department className imagePaths'
  );

  if (existingAttendance) {
    return res.json({
      duplicate: true,
      message: 'Attendance already marked for today.',
      attendance: serializeAttendance(existingAttendance, req)
    });
  }

  const snapshotPath = snapshotDataUrl
    ? await saveSnapshotFromDataUrl(snapshotDataUrl, `${student.studentCode}-${dateKey}`)
    : '';

  try {
    const attendance = await Attendance.create({
      student: student._id,
      name: student.name,
      studentCode: student.studentCode,
      dateKey,
      confidence,
      snapshotPath,
      attendedAt: new Date(),
      markedBy: req.user?._id,
      recognitionMeta: {
        distance,
        threshold,
        source: 'face-api.js',
        facesDetected
      }
    });

    const populatedAttendance = await Attendance.findById(attendance._id).populate(
      'student',
      'name studentCode department className imagePaths'
    );

    const serializedAttendance = serializeAttendance(populatedAttendance, req);
    getSocket().emit('attendance:marked', serializedAttendance);

    return res.status(201).json({
      duplicate: false,
      message: `Attendance marked for ${student.name}.`,
      attendance: serializedAttendance
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicateAttendance = await Attendance.findOne({ student: student._id, dateKey }).populate(
        'student',
        'name studentCode department className imagePaths'
      );

      return res.json({
        duplicate: true,
        message: 'Attendance already marked for today.',
        attendance: serializeAttendance(duplicateAttendance, req)
      });
    }

    throw error;
  }
});

export const getAttendance = asyncHandler(async (req, res) => {
  const filter = buildAttendanceFilter(req.query);
  const records = await Attendance.find(filter)
    .populate('student', 'name studentCode department className imagePaths status')
    .sort({ attendedAt: -1 });

  res.json({
    records: records.map((record) => serializeAttendance(record, req)),
    total: records.length
  });
});

export const exportAttendanceCsv = asyncHandler(async (req, res) => {
  const filter = buildAttendanceFilter(req.query);
  const records = await Attendance.find(filter).sort({ attendedAt: -1 });

  const csvRows = records.map((record) => ({
    name: record.name,
    studentCode: record.studentCode,
    date: record.dateKey,
    time: new Date(record.attendedAt).toLocaleTimeString(),
    confidence: Number(record.confidence || 0).toFixed(2),
    distance: Number(record.recognitionMeta?.distance || 0).toFixed(4)
  }));

  const parser = new Parser({
    fields: ['name', 'studentCode', 'date', 'time', 'confidence', 'distance']
  });

  const csv = parser.parse(csvRows);

  res.header('Content-Type', 'text/csv');
  res.attachment(`attendance-${getDateKey()}.csv`);
  res.send(csv);
});

export const exportAttendancePdf = asyncHandler(async (req, res) => {
  const filter = buildAttendanceFilter(req.query);
  const records = await Attendance.find(filter).sort({ attendedAt: -1 });
  const document = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${getDateKey()}.pdf"`);

  document.pipe(res);
  document.fontSize(20).text('Attendance Report', { align: 'center' });
  document.moveDown();
  document.fontSize(11).text(`Generated on: ${new Date().toLocaleString()}`);
  document.moveDown();

  records.forEach((record, index) => {
    const row = `${index + 1}. ${record.name} | ${record.studentCode} | ${record.dateKey} | ${new Date(
      record.attendedAt
    ).toLocaleTimeString()} | Confidence: ${Number(record.confidence || 0).toFixed(2)}`;

    document.text(row);

    if ((index + 1) % 25 === 0) {
      document.addPage();
    }
  });

  document.end();
});

export const getAnalyticsOverview = asyncHandler(async (req, res) => {
  const todayKey = getDateKey();
  const recentDates = getRecentDateKeys(7);
  const oldestDate = recentDates[0];
  const newestDate = recentDates[recentDates.length - 1];

  const [totalStudents, todayCount, totalAttendanceRecords, recentAttendance, topStudents, recentEntries] =
    await Promise.all([
      Student.countDocuments({ status: 'active' }),
      Attendance.countDocuments({ dateKey: todayKey }),
      Attendance.countDocuments(),
      Attendance.aggregate([
        {
          $match: {
            dateKey: {
              $gte: oldestDate,
              $lte: newestDate
            }
          }
        },
        {
          $group: {
            _id: '$dateKey',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]),
      Attendance.aggregate([
        {
          $group: {
            _id: '$student',
            name: { $first: '$name' },
            studentCode: { $first: '$studentCode' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 5
        }
      ]),
      Attendance.find({})
        .sort({ attendedAt: -1 })
        .limit(5)
        .populate('student', 'name studentCode department className imagePaths status')
    ]);

  const trendMap = new Map(recentAttendance.map((entry) => [entry._id, entry.count]));
  const weeklyTrend = recentDates.map((dateKey) => ({
    dateKey,
    count: trendMap.get(dateKey) || 0
  }));

  res.json({
    summary: {
      totalStudents,
      todayCount,
      absentCount: Math.max(totalStudents - todayCount, 0),
      totalAttendanceRecords,
      attendanceRate: totalStudents ? Number(((todayCount / totalStudents) * 100).toFixed(2)) : 0
    },
    weeklyTrend,
    topStudents,
    recentEntries: recentEntries.map((entry) => serializeAttendance(entry, req))
  });
});

// A lightweight, explainable attendance intelligence layer. It intentionally uses
// the attendance data already stored by the app, so it works without exposing a
// third-party AI API key or sending student data outside the school system.
export const getAiAttendanceInsights = asyncHandler(async (_req, res) => {
  const todayKey = getDateKey();
  const recentDates = getRecentDateKeys(7);
  const oldestDate = recentDates[0];

  const [totalStudents, todayCount, dailyCounts, atRiskStudents] = await Promise.all([
    Student.countDocuments({ status: 'active' }),
    Attendance.countDocuments({ dateKey: todayKey }),
    Attendance.aggregate([
      { $match: { dateKey: { $gte: oldestDate, $lte: todayKey } } },
      { $group: { _id: '$dateKey', count: { $sum: 1 } } }
    ]),
    Attendance.aggregate([
      { $match: { dateKey: { $gte: oldestDate, $lte: todayKey } } },
      { $group: { _id: '$student', name: { $first: '$name' }, studentCode: { $first: '$studentCode' }, daysPresent: { $sum: 1 } } },
      { $sort: { daysPresent: 1, name: 1 } },
      { $limit: 5 }
    ])
  ]);

  const todayRate = totalStudents ? Math.round((todayCount / totalStudents) * 100) : 0;
  const countByDate = new Map(dailyCounts.map((entry) => [entry._id, entry.count]));
  const priorDates = recentDates.slice(0, -1);
  const priorAverage = priorDates.length
    ? priorDates.reduce((total, dateKey) => total + (countByDate.get(dateKey) || 0), 0) / priorDates.length
    : 0;
  const trend = todayCount - priorAverage;
  const insights = [];

  if (!totalStudents) {
    insights.push({ level: 'info', title: 'Build the roster first', detail: 'Add active student profiles to begin attendance analysis.', action: 'Go to Students' });
  } else if (todayRate < 60) {
    insights.push({ level: 'attention', title: 'Today needs follow-up', detail: `${totalStudents - todayCount} of ${totalStudents} active students have not checked in yet.`, action: 'Run recognition' });
  } else {
    insights.push({ level: 'positive', title: 'Check-in progress is healthy', detail: `${todayRate}% of the active roster is present today.`, action: 'View attendance' });
  }

  if (priorAverage > 0 && trend <= -2) {
    insights.push({ level: 'attention', title: 'Attendance is below the recent pattern', detail: `Today has ${Math.abs(Math.round(trend))} fewer check-ins than the prior six-day average.`, action: 'Review trend' });
  } else if (priorAverage > 0) {
    insights.push({ level: 'positive', title: 'Attendance is tracking steadily', detail: `Today is ${Math.abs(Math.round(trend))} check-ins ${trend >= 0 ? 'above' : 'below'} the recent daily average.`, action: 'Review trend' });
  }

  if (atRiskStudents.length && atRiskStudents[0].daysPresent < 2) {
    const names = atRiskStudents.slice(0, 3).map((student) => student.name).join(', ');
    insights.push({ level: 'info', title: 'Possible follow-up group', detail: `${names} recorded the fewest check-ins over the last seven days.`, action: 'View attendance' });
  }

  res.json({ generatedAt: new Date().toISOString(), todayRate, insights });
});
