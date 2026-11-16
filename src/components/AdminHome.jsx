import React from 'react';
import { RefreshCw } from 'lucide-react';
import { TOTAL_CAGES, todayStr } from '../lib/booking';

const ymd = (str) => String(str || '').split('T')[0];
const md = (str) => {
  const s = ymd(str);
  if (!s) return '';
  const [, m, d] = s.split('-').map(Number);
  return `${m}/${d}`;
};
const petShortName = (petName) => String(petName || '').split(' (')[0];
const petType = (petName) => {
  const m = String(petName || '').match(/\((兔子|天竺鼠|龍貓)/);
  return m ? m[1] : '';
};
const roomNo = (id) => String(id).padStart(2, '0');

function StatCard({ label, value, sub, tone }) {
  const color = tone === 'carrot' ? 'text-carrot-link' : tone === 'sage' ? 'text-sage' : 'text-ink';
  return (
    <div className="bg-white rounded-3xl px-5 py-4 shadow-[0_1px_0_#EADBC8] flex flex-col gap-1">
      <span className="text-sm text-bark">{label}</span>
      <span className={`text-4xl font-bold ${color}`}>{value}</span>
      <span className="text-[13px] text-bark min-h-[20px]">{sub}</span>
    </div>
  );
}

export default function AdminHome({ rooms, allBookings, pendingCount, onRoomClick, onAssign, onGoPending, onRefresh }) {
  const today = todayStr();
  const bookingById = new Map(allBookings.map((b) => [b.id, b]));

  // 每個籠位的狀態
  const roomCards = rooms.map((room) => {
    const booking = room.status === 'OCCUPIED' ? bookingById.get(room.current_booking_id) : null;
    const out = booking ? ymd(booking.check_out_date) : '';
    let state = 'vacant';
    if (room.status === 'OCCUPIED') {
      if (!booking) state = 'orphan';
      else if (out < today) state = 'overdue';
      else if (out === today) state = 'out';
      else state = 'stay';
    }
    return { room, booking, state };
  });

  // 今日退房（含逾期），以預約單分組
  const checkoutMap = new Map();
  roomCards.filter((c) => c.state === 'out' || c.state === 'overdue').forEach((c) => {
    const entry = checkoutMap.get(c.booking.id) || { booking: c.booking, rooms: [], overdue: c.state === 'overdue' };
    entry.rooms.push(c.room);
    checkoutMap.set(c.booking.id, entry);
  });
  const checkouts = [...checkoutMap.values()];
  const checkoutRoomCount = checkouts.reduce((n, e) => n + e.rooms.length, 0);

  // 今日入住
  const checkins = allBookings.filter(
    (b) => ymd(b.check_in_date) === today && (b.status === 'PENDING' || b.status === 'CONFIRMED')
  );
  const unassignedToday = checkins.filter((b) => b.status === 'PENDING').length;

  const vacant = rooms.filter((r) => r.status === 'VACANT').length;
  const [, tm, td] = today.split('-').map(Number);
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date(today + 'T00:00:00').getDay()];

  const cardClass = {
    vacant: 'bg-white border-[1.5px] border-dashed border-sage-edge text-sage',
    stay: 'bg-peach border-[1.5px] border-peach-edge text-ink',
    out: 'bg-carrot border-[1.5px] border-carrot text-white',
    overdue: 'bg-carrot border-[1.5px] border-carrot text-white',
    orphan: 'bg-rose-50 border-[1.5px] border-rose-300 text-rose-900',
  };
  const badge = { out: '今日退房', overdue: '已過退房日', orphan: '資料異常' };

  return (
    <main className="max-w-[1360px] mx-auto space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-round text-3xl">今天 {tm}/{td}（{weekday}）</h1>
        <span className="text-bark">今天有 {checkouts.length} 位要退房、{checkins.length} 位要入住</span>
      </div>

      {/* 今日看板 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="今日退房" value={checkouts.length} tone="carrot" sub={checkouts.length ? checkouts.map((e) => e.rooms.map((r) => roomNo(r.id)).join('、')).join('、') + ' 號' : '沒有要退房的'} />
        <StatCard label="今日入住" value={checkins.length} tone="sage" sub={unassignedToday ? `還有 ${unassignedToday} 位未派房` : checkins.length ? '都已派房' : '沒有要入住的'} />
        <StatCard label="空籠位" value={<>{vacant}<span className="text-lg text-bark font-medium"> / {TOTAL_CAGES}</span></>} sub={checkoutRoomCount ? `退房後會變 ${vacant + checkoutRoomCount} 籠` : ''} />
        <div className="bg-white rounded-3xl px-5 py-4 shadow-[0_1px_0_#EADBC8] flex flex-col gap-1">
          <span className="text-sm text-bark">待派房預約</span>
          <span className="text-4xl font-bold">{pendingCount}</span>
          <button type="button" onClick={onGoPending} className="text-[13px] text-carrot-link font-bold text-left min-h-[20px]">前往派房 →</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-6 items-start">
        {/* 籠位格子 */}
        <section className="flex-[999_1_640px] min-w-0 bg-white rounded-3xl p-5 shadow-[0_1px_0_#EADBC8] space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <h2 className="font-round text-xl">{TOTAL_CAGES} 籠位</h2>
            <div className="flex flex-wrap items-center gap-4 text-[13px]">
              <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded border-[1.5px] border-dashed border-sage-edge bg-white" />空房</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-peach border-[1.5px] border-peach-edge" />住宿中</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-carrot" />今日退房</span>
              <button type="button" onClick={onRefresh} className="h-9 px-3 rounded-full border border-line text-bark inline-flex items-center gap-1.5">
                <RefreshCw size={14} /> 重新整理
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-3">
            {roomCards.map(({ room, booking, state }) => (
              <button
                key={room.id}
                type="button"
                onClick={() => onRoomClick(room)}
                className={`min-h-[104px] rounded-2xl p-3 flex flex-col items-start justify-between gap-1 text-left transition hover:-translate-y-0.5 hover:shadow-md ${cardClass[state]}`}
              >
                <span className="flex w-full justify-between items-center">
                  <span className="text-[13px] font-bold opacity-85">{roomNo(room.id)}</span>
                  {badge[state] && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${state === 'orphan' ? 'bg-rose-100' : 'bg-white text-carrot-link'}`}>{badge[state]}</span>
                  )}
                </span>
                <span className="text-[17px] font-bold leading-tight line-clamp-2">
                  {state === 'vacant' ? '空房' : booking ? petShortName(booking.pet_name) : '找不到預約單'}
                </span>
                <span className="text-xs opacity-90">
                  {state === 'vacant'
                    ? '可派房'
                    : booking
                      ? `${petType(booking.pet_name)} ${md(booking.check_in_date)}–${state === 'out' ? '今天' : md(booking.check_out_date)}`
                      : '點開可釋放籠位'}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* 今日待辦 */}
        <aside className="flex-[1_1_300px] min-w-0 space-y-4">
          <section className="bg-white rounded-3xl p-5 shadow-[0_1px_0_#EADBC8] space-y-3">
            <h2 className="font-round text-xl">今日退房</h2>
            {checkouts.length === 0 && <p className="text-sm text-bark">今天沒有要退房的寶貝。</p>}
            {checkouts.map(({ booking, rooms: rs, overdue }) => (
              <div key={booking.id} className="flex items-center gap-3 p-3 rounded-2xl bg-peach">
                <span className="w-11 h-11 shrink-0 rounded-xl bg-carrot text-white flex items-center justify-center font-bold text-sm">{rs.map((r) => roomNo(r.id)).join(',')}</span>
                <span className="flex-1 min-w-0 flex flex-col">
                  <b className="truncate">{petShortName(booking.pet_name)}（{petType(booking.pet_name) || '寵物'}）</b>
                  <span className="text-[13px] text-bark truncate">{booking.owner_name}{overdue ? `・原訂 ${md(booking.check_out_date)} 退房` : ''}</span>
                </span>
                <button type="button" onClick={() => onRoomClick(rs[0])} className="h-10 px-3.5 rounded-full bg-ink text-white text-sm font-bold shrink-0">退房</button>
              </div>
            ))}
          </section>

          <section className="bg-white rounded-3xl p-5 shadow-[0_1px_0_#EADBC8] space-y-3">
            <h2 className="font-round text-xl">今日入住</h2>
            {checkins.length === 0 && <p className="text-sm text-bark">今天沒有要入住的寶貝。</p>}
            {checkins.map((b) => {
              const assigned = b.status === 'CONFIRMED';
              const rs = b.assigned_rooms?.length ? b.assigned_rooms : b.room_id ? [b.room_id] : [];
              return (
                <div key={b.id} className={`flex items-center gap-3 p-3 rounded-2xl ${assigned ? 'bg-sage-soft' : 'border-[1.5px] border-dashed border-line'}`}>
                  <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-bold text-sm ${assigned ? 'bg-sage text-white' : 'bg-oat text-bark'}`}>
                    {assigned ? rs.map(roomNo).join(',') : '?'}
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col">
                    <b className="truncate">{petShortName(b.pet_name)}（{petType(b.pet_name) || '寵物'}）</b>
                    <span className={`text-[13px] truncate ${assigned ? 'text-[#4A6B55]' : 'text-bark'}`}>{b.owner_name}・{assigned ? '已派房' : '尚未派房'}</span>
                  </span>
                  {!assigned && (
                    <button type="button" onClick={() => onAssign(b)} className="h-10 px-3.5 rounded-full border-[1.5px] border-carrot text-carrot-link text-sm font-bold shrink-0">派房</button>
                  )}
                </div>
              );
            })}
          </section>
        </aside>
      </div>
    </main>
  );
}
