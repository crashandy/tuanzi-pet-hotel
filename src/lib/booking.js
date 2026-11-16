// 🐰 店內設定
export const TOTAL_CAGES = 20; // 總籠位數
export const LINE_URL = 'https://line.me/R/ti/p/@262lvcuh'; // 糰子兔官方 LINE
export const LINE_NAME = '糰子兔官方 LINE'; // 顯示給客人看的 LINE 名稱

// 推算單筆預約佔用的籠位數
export const countBookingCages = (booking) => {
  if (booking.assigned_rooms && booking.assigned_rooms.length > 0) return booking.assigned_rooms.length;
  const petStr = booking.pet_name || '';
  if (petStr.includes('分開住不同籠')) {
    const match = petStr.match(/(\d+)隻/);
    return match ? parseInt(match[1]) : 1;
  }
  return 1;
};

// 找出住宿期間內「籠位不夠」的日期（只計算待派房與已入住的預約）
// 以「過夜」計算：10/1~10/3 檢查 10/1、10/2 兩晚
export const findFullDates = (bookings, checkIn, checkOut, neededCages) => {
  if (!checkIn || !checkOut) return [];
  const start = new Date(`${String(checkIn).split('T')[0]}T00:00:00Z`);
  const end = new Date(`${String(checkOut).split('T')[0]}T00:00:00Z`);
  if (isNaN(start) || isNaN(end) || end <= start) return [];

  const active = (bookings || []).filter(b => b.status === 'PENDING' || b.status === 'CONFIRMED');
  const full = [];
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    const used = active.reduce((sum, b) => {
      const bIn = String(b.check_in_date || '').split('T')[0];
      const bOut = String(b.check_out_date || '').split('T')[0];
      return bIn <= day && day < bOut ? sum + countBookingCages(b) : sum;
    }, 0);
    if (used + neededCages > TOTAL_CAGES) full.push(day);
  }
  return full;
};

// 輔助函式：確保日期一律乾淨顯示為 YYYY-MM-DD
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return String(dateStr).split('T')[0];
};

// 某一晚已被佔用的籠位數（只計算待派房與已入住）
export const cagesUsedOn = (bookings, day) => (bookings || []).reduce((sum, b) => {
  if (b.status !== 'PENDING' && b.status !== 'CONFIRMED') return sum;
  const bIn = String(b.check_in_date || '').split('T')[0];
  const bOut = String(b.check_out_date || '').split('T')[0];
  return bIn <= day && day < bOut ? sum + countBookingCages(b) : sum;
}, 0);

// 今天的日期 YYYY-MM-DD（以台灣時間計算）
export const todayStr = () => {
  const now = new Date();
  const tw = new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000);
  return `${tw.getFullYear()}-${String(tw.getMonth() + 1).padStart(2, '0')}-${String(tw.getDate()).padStart(2, '0')}`;
};
