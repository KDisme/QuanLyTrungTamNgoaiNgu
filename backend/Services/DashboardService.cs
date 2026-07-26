using LanguageCenter.Api.Infrastructure;

namespace LanguageCenter.Api.Services;

public sealed class DashboardService
{
    private readonly DbService _db;
    public DashboardService(DbService db) => _db = db;

    public async Task<object> GetStatsAsync(int tenantId, int? month = null, int? year = null)
    {
        var now = DateTime.Now;
        var m = month ?? now.Month;
        var y = year ?? now.Year;

        // ---- Thống kê tổng quan (flat, khớp Frontend) ----
        var students = await _db.ScalarAsync<long>("""
            SELECT COUNT(*) FROM users u
            JOIN roles r ON r.user_id=u.id AND r.tenant_id=u.tenant_id
            WHERE u.tenant_id=@tenantId AND r.role_type='student' AND u.is_active=TRUE
            """, new { tenantId });

        var teachers = await _db.ScalarAsync<long>("""
            SELECT COUNT(DISTINCT u.id) FROM users u
            JOIN roles r ON r.user_id=u.id AND r.tenant_id=u.tenant_id
            WHERE u.tenant_id=@tenantId AND r.role_type='teacher' AND u.is_active=TRUE
            """, new { tenantId });

        var activeClasses = await _db.ScalarAsync<long>("""
            SELECT COUNT(*) FROM classes WHERE tenant_id=@tenantId AND status='active'
            """, new { tenantId });

        var todaySessions = await _db.ScalarAsync<long>("""
            SELECT COUNT(*) FROM schedules
            WHERE tenant_id=@tenantId AND session_date=CURRENT_DATE AND status='scheduled'
            """, new { tenantId });

        // ---- Doanh thu theo phương thức và theo ngày ----
        var revenueByMethod = await _db.QueryAsync("""
            SELECT payment_method, COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
            FROM fee_transactions
            WHERE tenant_id=@tenantId AND is_cancelled=FALSE
              AND EXTRACT(MONTH FROM paid_at)=@m AND EXTRACT(YEAR FROM paid_at)=@y
            GROUP BY payment_method
            """, new { tenantId, m, y });

        var revenueByDay = await _db.QueryAsync("""
            SELECT DATE(paid_at) AS day, SUM(amount) AS amount
            FROM fee_transactions
            WHERE tenant_id=@tenantId AND is_cancelled=FALSE
              AND EXTRACT(MONTH FROM paid_at)=@m AND EXTRACT(YEAR FROM paid_at)=@y
            GROUP BY DATE(paid_at) ORDER BY day
            """, new { tenantId, m, y });

        var totalRevenue = revenueByMethod.Sum(r => Convert.ToDouble(r.GetValueOrDefault("total") ?? 0));
        var totalTransactions = revenueByMethod.Sum(r => Convert.ToInt64(r.GetValueOrDefault("count") ?? 0));

        // ---- Chi phí ----
        var totalExpenses = await _db.ScalarAsync<double>("""
            SELECT COALESCE(SUM(amount),0) FROM expenses
            WHERE tenant_id=@tenantId AND is_active=TRUE
              AND EXTRACT(MONTH FROM expense_date)=@m AND EXTRACT(YEAR FROM expense_date)=@y
            """, new { tenantId, m, y });

        // ---- Hóa đơn chờ ----
        var pendingInvoice = await _db.QuerySingleAsync("""
            SELECT COUNT(*) AS count, COALESCE(SUM(fci.amount_due - fci.amount_paid),0) AS total
            FROM fee_collection_items fci
            JOIN fee_collections fc ON fc.id=fci.collection_id
            WHERE fci.tenant_id=@tenantId AND fci.status IN ('pending','partial') AND fc.status='active'
            """, new { tenantId });

        // ---- Công nợ theo nhóm tuổi ----
        var debtAgingRaw = await _db.QuerySingleAsync("""
            SELECT
              COUNT(DISTINCT CASE WHEN CURRENT_DATE - fc.due_date BETWEEN 1 AND 30  THEN fci.student_id END) AS days_1_30,
              COUNT(DISTINCT CASE WHEN CURRENT_DATE - fc.due_date BETWEEN 31 AND 60 THEN fci.student_id END) AS days_31_60,
              COUNT(DISTINCT CASE WHEN CURRENT_DATE - fc.due_date BETWEEN 61 AND 90 THEN fci.student_id END) AS days_61_90,
              COUNT(DISTINCT CASE WHEN CURRENT_DATE - fc.due_date > 90             THEN fci.student_id END) AS days_90_plus,
              COALESCE(SUM(CASE WHEN CURRENT_DATE - fc.due_date BETWEEN 1  AND 30 THEN fci.amount_due - fci.amount_paid ELSE 0 END),0) AS amt_1_30,
              COALESCE(SUM(CASE WHEN CURRENT_DATE - fc.due_date BETWEEN 31 AND 60 THEN fci.amount_due - fci.amount_paid ELSE 0 END),0) AS amt_31_60,
              COALESCE(SUM(CASE WHEN CURRENT_DATE - fc.due_date BETWEEN 61 AND 90 THEN fci.amount_due - fci.amount_paid ELSE 0 END),0) AS amt_61_90,
              COALESCE(SUM(CASE WHEN CURRENT_DATE - fc.due_date > 90              THEN fci.amount_due - fci.amount_paid ELSE 0 END),0) AS amt_90_plus,
              COUNT(DISTINCT fci.student_id) AS total_students_in_debt,
              COALESCE(SUM(fci.amount_due - fci.amount_paid),0) AS total_debt,
              COUNT(DISTINCT fci.id) AS total_overdue_items
            FROM fee_collection_items fci
            JOIN fee_collections fc ON fc.id = fci.collection_id
            WHERE fci.tenant_id=@tenantId AND fci.status IN ('pending','partial')
              AND fc.status='active' AND fc.due_date < CURRENT_DATE
            """, new { tenantId });

        var topDebtors = await _db.QueryAsync("""
            SELECT u.full_name, sp.student_code,
                   SUM(fci.amount_due - fci.amount_paid) AS debt_amount,
                   COUNT(*) AS overdue_collections,
                   MAX(CURRENT_DATE - fc.due_date) AS max_overdue_days
            FROM fee_collection_items fci
            JOIN fee_collections fc ON fc.id = fci.collection_id
            JOIN users u ON u.id = fci.student_id
            LEFT JOIN student_profiles sp ON sp.user_id = u.id AND sp.tenant_id = fci.tenant_id
            WHERE fci.tenant_id=@tenantId AND fci.status IN ('pending','partial')
              AND fc.status='active' AND fc.due_date < CURRENT_DATE
            GROUP BY u.full_name, sp.student_code
            ORDER BY debt_amount DESC LIMIT 10
            """, new { tenantId });

        // ---- Thống kê chi nhánh ----
        var branchStats = await _db.QueryAsync("""
            SELECT b.name AS branch_name, COUNT(DISTINCT cs.student_id) AS student_count
            FROM branches b
            JOIN classes c ON c.branch_id=b.id AND c.status='active'
            JOIN class_students cs ON cs.class_id=c.id AND cs.status='active'
            WHERE b.tenant_id=@tenantId
            GROUP BY b.id, b.name ORDER BY student_count DESC
            """, new { tenantId });

        // ---- Điểm danh tuần ----
        var weeklyAttendance = await _db.QueryAsync("""
            SELECT s.session_date,
                   COUNT(*) FILTER (WHERE a.status='present') AS present_count,
                   COUNT(*) AS total_count
            FROM attendance a
            JOIN schedules s ON s.id=a.schedule_id
            WHERE a.tenant_id=@tenantId
              AND s.session_date >= CURRENT_DATE - INTERVAL '6 days'
              AND s.session_date <= CURRENT_DATE
            GROUP BY s.session_date ORDER BY s.session_date
            """, new { tenantId });

        // ---- Phân phối trạng thái học viên ----
        var studentStatusDist = await _db.QueryAsync("""
            SELECT sp.study_status, COUNT(*) AS count
            FROM student_profiles sp
            WHERE sp.tenant_id=@tenantId
            GROUP BY sp.study_status
            """, new { tenantId });

        // ---- Top lớp học ----
        var topClasses = await _db.QueryAsync("""
            SELECT c.name, COUNT(cs.student_id) AS student_count
            FROM classes c
            JOIN class_students cs ON cs.class_id=c.id AND cs.status='active'
            WHERE c.tenant_id=@tenantId AND c.status='active'
            GROUP BY c.id, c.name
            ORDER BY student_count DESC LIMIT 5
            """, new { tenantId });

        // ---- Bài tập / Bài thi chờ chấm ----
        var pendingHomework = await _db.ScalarAsync<long>("""
            SELECT COUNT(*) FROM homework_submissions hs
            JOIN homework_assignment_students has2 ON has2.id=hs.assignment_student_id
            JOIN homework_assignments ha ON ha.id=has2.assignment_id
            WHERE ha.tenant_id=@tenantId AND hs.status='submitted'
            """, new { tenantId });

        var pendingMockExams = await _db.ScalarAsync<long>("""
            SELECT COUNT(*) FROM mock_exam_students mes
            JOIN mock_exams me ON me.id=mes.mock_exam_id
            WHERE me.tenant_id=@tenantId AND mes.status='submitted'
            """, new { tenantId });

        // ---- Build response (flat, khớp Frontend contract) ----
        return new
        {
            // Thẻ tổng quan
            students,
            activeClasses,
            teachers,
            todaySessions,
            pendingHomeworkGrading = pendingHomework,
            pendingMockExamGrading = pendingMockExams,

            // Tài chính
            revenue = new
            {
                byMethod = revenueByMethod,
                byDay = revenueByDay,
                total = totalRevenue,
                month = m,
                year = y,
            },
            expenses = new { total = totalExpenses },
            netProfit = totalRevenue - totalExpenses,
            transactions = totalTransactions,

            // Hóa đơn chờ
            pendingInvoices = new
            {
                count = Convert.ToInt64(pendingInvoice?.GetValueOrDefault("count") ?? 0),
                total = Convert.ToDouble(pendingInvoice?.GetValueOrDefault("total") ?? 0),
            },

            // Công nợ
            debtAging = debtAgingRaw == null ? new Dictionary<string, object>() : new Dictionary<string, object>(debtAgingRaw)
            {
                ["topDebtors"] = topDebtors,
            },

            // Chi nhánh
            branchStats,

            // Bổ trợ
            weeklyAttendance = weeklyAttendance.Select(r => new
            {
                date = r.GetValueOrDefault("session_date"),
                present = Convert.ToInt64(r.GetValueOrDefault("present_count") ?? 0),
                total = Convert.ToInt64(r.GetValueOrDefault("total_count") ?? 0),
                rate = Convert.ToInt64(r.GetValueOrDefault("total_count") ?? 0) > 0
                    ? (int)Math.Round(Convert.ToDouble(r.GetValueOrDefault("present_count") ?? 0)
                       / Convert.ToDouble(r.GetValueOrDefault("total_count") ?? 1) * 100)
                    : 0,
            }),
            studentStatusDistribution = studentStatusDist.Select(r =>
            {
                var s = r.GetValueOrDefault("study_status")?.ToString() ?? "";
                var labelMap = new Dictionary<string, string>
                {
                    ["active"]    = "Đang học",
                    ["paused"]    = "Tạm nghỉ",
                    ["graduated"] = "Đã tốt nghiệp",
                    ["dropped"]   = "Đã nghỉ",
                };
                return new
                {
                    status = (object?)s,
                    label  = (object?)(labelMap.TryGetValue(s, out var lbl) ? lbl : s),
                    count  = Convert.ToInt64(r.GetValueOrDefault("count") ?? 0),
                };
            }),
            topClasses = topClasses.Select(r => new
            {
                name = r.GetValueOrDefault("name"),
                count = Convert.ToInt64(r.GetValueOrDefault("student_count") ?? 0),
            }),
        };
    }
}
