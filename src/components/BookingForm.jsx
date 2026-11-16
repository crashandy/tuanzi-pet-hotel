import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, Lock } from 'lucide-react';
import { cagesUsedOn, todayStr, TOTAL_CAGES, LINE_URL } from '../lib/booking';

const PET_TYPES = [
  { value: '兔子', price: 350 },
  { value: '天竺鼠', price: 300 },
  { value: '龍貓', price: 350 },
];

const STAY_TYPES = [
  { value: '擠同一籠', note: '第 2 隻起每隻 +$100 / 天（不打折），最多 3 隻' },
  { value: '分開住不同籠', note: '每隻各住 1 籠，按籠數計價' },
];

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const pad = (n) => String(n).padStart(2, '0');
const toDayStr = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const shortDate = (str) => {
  if (!str) return '';
  const [y, m, d] = str.split('-').map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${m}/${d}（${wd}）`;
};

// ---- 小元件 ----

function Section({ no, title, hint, children }) {
  return (
    <section className="bg-white rounded-3xl p-5 shadow-[0_1px_0_#EADBC8] space-y-4">
      <h2 className="font-round text-[19px] flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-full bg-sand inline-flex items-center justify-center text-sm font-sans">{no}</span>
        {title}
        {hint && <span className="ml-auto text-xs text-bark font-sans">{hint}</span>}
      </h2>
      {children}
    </section>
  );
}

function FieldLabel({ children, required }) {
  return (
    <span className="text-sm font-medium flex items-center gap-2">
      {children}
      {required && <span className="text-xs font-normal text-carrot-link">必填</span>}
    </span>
  );
}

const inputClass = 'h-12 w-full min-w-0 border-[1.5px] border-line rounded-xl px-3.5 bg-[#FFFDFA] text-ink placeholder:text-[#A8968A] focus:outline-none focus:border-carrot';

// 圓角膠囊選項（例如喝水方式）
function Pills({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = opt === value;
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(opt)}
            className={`h-11 px-[18px] rounded-full border-[1.5px] text-[15px] transition ${
              on ? 'border-carrot bg-carrot-soft text-carrot-dark font-bold' : 'border-line bg-white text-ink'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// 二選一切換（例如公／母）
function Segmented({ options, value, onChange }) {
  return (
    <div className="flex bg-oat rounded-xl p-1 gap-1">
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(opt.value)}
            className={`flex-1 h-10 rounded-[9px] text-[15px] transition ${
              on ? 'bg-white text-ink font-bold shadow-[0_1px_2px_rgba(59,42,32,.15)]' : 'text-bark'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// 月曆選日期：先點入住，再點退房；已客滿的日期會標示「滿」
function RangeCalendar({ checkIn, checkOut, onChange, bookings, neededCages }) {
  const today = todayStr();
  const initial = checkIn || today;
  const [view, setView] = useState({ y: Number(initial.slice(0, 4)), m: Number(initial.slice(5, 7)) - 1 });

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const isCurrentMonth = view.y === Number(today.slice(0, 4)) && view.m === Number(today.slice(5, 7)) - 1;

  const moveMonth = (delta) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  const pick = (day) => {
    if (!checkIn || checkOut || day <= checkIn) {
      onChange(day, '');
    } else {
      onChange(checkIn, day);
    }
  };

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(<div key={`blank-${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const day = toDayStr(view.y, view.m, d);
    const past = day < today;
    const full = !past && cagesUsedOn(bookings, day) + neededCages > TOTAL_CAGES;
    const isEdge = day === checkIn || day === checkOut;
    const inRange = checkIn && checkOut && day > checkIn && day < checkOut;

    let cls = 'text-ink';
    if (past) cls = 'text-[#B5A393]';
    else if (isEdge) cls = 'bg-carrot text-white font-bold rounded-full';
    else if (inRange) cls = 'bg-carrot-soft text-carrot-dark';
    else if (full) cls = 'text-[#A8968A] line-through';

    cells.push(
      <button
        key={day}
        type="button"
        disabled={past}
        onClick={() => pick(day)}
        aria-label={`${view.m + 1} 月 ${d} 日${full ? '，已客滿' : ''}`}
        className={`h-11 flex flex-col items-center justify-center text-[15px] leading-none ${cls} disabled:cursor-not-allowed`}
      >
        {d}
        {full && !past && <span className="text-[9px] mt-0.5 no-underline text-carrot-link font-bold" style={{ textDecoration: 'none' }}>滿</span>}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="上個月" disabled={isCurrentMonth} onClick={() => moveMonth(-1)} className="w-11 h-11 flex items-center justify-center rounded-full disabled:opacity-30">
          <ChevronLeft size={20} />
        </button>
        <span className="font-bold">{view.y} 年 {view.m + 1} 月</span>
        <button type="button" aria-label="下個月" onClick={() => moveMonth(1)} className="w-11 h-11 flex items-center justify-center rounded-full">
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-bark">
        {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">{cells}</div>
    </div>
  );
}

// ---- 主表單 ----

export default function BookingForm({ formData, setFormData, onPetCountChange, priceInfo, fullDates, neededCages, bookings, onSubmit, onStaffLogin }) {
  const set = (key) => (value) => setFormData((prev) => ({ ...prev, [key]: value }));
  const hasDates = formData.check_in_date && formData.check_out_date;
  const isFull = fullDates.length > 0;
  const wantsCamera = formData.mi_home_id !== '不需要';
  const count = Number(formData.pet_count) || 1;

  return (
    <div className="min-h-screen bg-cream pb-32">
      {/* 品牌頁首 */}
      <header className="bg-sand rounded-b-[28px]">
        <div className="max-w-xl mx-auto px-5 pt-7 pb-6 flex items-center gap-3.5">
          <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className="shrink-0">
            <circle cx="28" cy="28" r="28" fill="#FFFFFF" />
            <ellipse cx="20" cy="15" rx="5" ry="12" fill="#FFFFFF" stroke="#3B2A20" strokeWidth="2.5" />
            <ellipse cx="35" cy="15" rx="5" ry="12" fill="#FFFFFF" stroke="#3B2A20" strokeWidth="2.5" />
            <ellipse cx="20" cy="15" rx="2" ry="7" fill="#F2B79A" />
            <ellipse cx="35" cy="15" rx="2" ry="7" fill="#F2B79A" />
            <ellipse cx="28" cy="34" rx="16" ry="13" fill="#FFFFFF" stroke="#3B2A20" strokeWidth="2.5" />
            <circle cx="22" cy="32" r="2" fill="#3B2A20" />
            <circle cx="34" cy="32" r="2" fill="#3B2A20" />
            <circle cx="18" cy="37" r="2.5" fill="#F2B79A" />
            <circle cx="38" cy="37" r="2.5" fill="#F2B79A" />
            <path d="M26 36 Q28 38 30 36" fill="none" stroke="#3B2A20" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="flex-1">
            <h1 className="font-round text-2xl">糰子兔住宿預約</h1>
            <p className="text-[13px] text-bark">兔子・天竺鼠・龍貓 安心住宿</p>
          </div>
          {onStaffLogin && (
            <button type="button" onClick={onStaffLogin} aria-label="店員登入" className="w-11 h-11 rounded-full bg-white/70 text-bark flex items-center justify-center">
              <Lock size={18} />
            </button>
          )}
        </div>
      </header>

      <form id="booking-form" onSubmit={onSubmit} className="max-w-xl mx-auto px-4 pt-5 space-y-4">
        {/* 1 飼主資料 */}
        <Section no="1" title="飼主資料">
          <label className="flex flex-col gap-1.5">
            <FieldLabel required>飼主姓名</FieldLabel>
            <input required type="text" placeholder="例：王小明" className={inputClass} value={formData.owner_name} onChange={(e) => set('owner_name')(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <FieldLabel required>聯絡電話</FieldLabel>
            <input required type="tel" inputMode="tel" placeholder="09xx-xxx-xxx" className={inputClass} value={formData.owner_phone} onChange={(e) => set('owner_phone')(e.target.value)} />
          </label>
        </Section>

        {/* 2 寶貝資料 */}
        <Section no="2" title="寶貝資料">
          <div className="space-y-2">
            <FieldLabel>種類</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              {PET_TYPES.map((t) => {
                const on = formData.pet_type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set('pet_type')(t.value)}
                    className={`h-16 rounded-2xl border-[1.5px] flex flex-col items-center justify-center gap-0.5 transition ${
                      on ? 'border-carrot bg-carrot-soft text-carrot-dark' : 'border-line bg-white text-ink'
                    }`}
                  >
                    <span className="font-bold">{t.value}</span>
                    <span className="text-xs">${t.price} / 天</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 min-w-0">
              <FieldLabel required>寵物名字</FieldLabel>
              <input required type="text" placeholder="例：糰子" className={inputClass} value={formData.pet_name} onChange={(e) => set('pet_name')(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 min-w-0">
              <FieldLabel>年齡</FieldLabel>
              <input type="text" placeholder="例：2 歲" className={inputClass} value={formData.pet_age} onChange={(e) => set('pet_age')(e.target.value)} />
            </label>
          </div>

          <div className="flex items-center justify-between">
            <FieldLabel>幾隻寶貝</FieldLabel>
            <div className="flex items-center gap-1 bg-oat rounded-full p-1">
              <button type="button" aria-label="減少一隻" disabled={count <= 1} onClick={() => onPetCountChange(count - 1)} className="w-11 h-11 rounded-full bg-white flex items-center justify-center disabled:opacity-40">
                <Minus size={18} />
              </button>
              <span className="min-w-[44px] text-center text-lg font-bold" aria-live="polite">{count}</span>
              <button type="button" aria-label="增加一隻" disabled={count >= 10} onClick={() => onPetCountChange(count + 1)} className="w-11 h-11 rounded-full bg-white flex items-center justify-center disabled:opacity-40">
                <Plus size={18} />
              </button>
            </div>
          </div>

          {count > 1 && (
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <FieldLabel>住宿方式</FieldLabel>
                <span className="text-xs text-bark">會影響價格</span>
              </div>
              {STAY_TYPES.filter((st) => !(st.value === '擠同一籠' && count > 3)).map((st) => {
                const on = formData.stay_type === st.value;
                return (
                  <button
                    key={st.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set('stay_type')(st.value)}
                    className={`w-full min-h-[60px] px-4 py-2.5 rounded-2xl border-[1.5px] flex flex-col items-start justify-center gap-0.5 text-left transition ${
                      on ? 'border-carrot bg-carrot-soft text-carrot-dark' : 'border-line bg-white text-ink'
                    }`}
                  >
                    <span className="font-bold text-[15px]">{st.value}</span>
                    <span className="text-xs text-bark">{st.note}</span>
                  </button>
                );
              })}
              {count > 3 && <p className="text-xs text-bark">超過 3 隻無法擠同一籠，請分開住。</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <FieldLabel>性別</FieldLabel>
              <Segmented value={formData.pet_gender} onChange={set('pet_gender')} options={[{ value: '公', label: '公' }, { value: '母', label: '母' }]} />
            </div>
            <div className="space-y-2">
              <FieldLabel>絕育</FieldLabel>
              <Segmented value={formData.is_neutered} onChange={set('is_neutered')} options={[{ value: '已絕育', label: '已絕育' }, { value: '未絕育', label: '未絕育' }]} />
            </div>
          </div>
        </Section>

        {/* 3 住宿日期 */}
        <Section no="3" title="住宿日期">
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-xl border-[1.5px] px-3 py-2.5 ${!formData.check_in_date || !formData.check_out_date ? (formData.check_in_date ? 'border-line' : 'border-carrot') : 'border-line'}`}>
              <div className="text-xs text-bark">入住</div>
              <div className="font-bold">{formData.check_in_date ? shortDate(formData.check_in_date) : '請點選日期'}</div>
            </div>
            <div className={`rounded-xl border-[1.5px] px-3 py-2.5 ${formData.check_in_date && !formData.check_out_date ? 'border-carrot' : 'border-line'}`}>
              <div className="text-xs text-bark">退房</div>
              <div className="font-bold">{formData.check_out_date ? shortDate(formData.check_out_date) : formData.check_in_date ? '再點退房日' : '—'}</div>
            </div>
          </div>

          <RangeCalendar
            checkIn={formData.check_in_date}
            checkOut={formData.check_out_date}
            bookings={bookings}
            neededCages={neededCages}
            onChange={(inDay, outDay) => setFormData((prev) => ({ ...prev, check_in_date: inDay, check_out_date: outDay }))}
          />

          {hasDates && !isFull && (
            <div className="bg-sage-soft text-sage rounded-xl px-3.5 py-2.5 text-sm flex justify-between gap-2">
              <span>共 <b>{priceInfo.days}</b> 天</span>
              <span>{priceInfo.discountText}</span>
            </div>
          )}

          {isFull && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-sm text-rose-900 space-y-2">
              <p className="font-bold">很抱歉，以下日期目前住宿已滿：</p>
              <p>{fullDates.map(shortDate).join('、')}</p>
              <p>請先用 LINE 聯繫我們，確認是否還能安排。</p>
              <a href={LINE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center bg-[#06C755] text-white font-bold px-4 rounded-full">
                用 LINE 聯繫我們
              </a>
            </div>
          )}
        </Section>

        {/* 4 照護習慣 */}
        <Section no="4" title="照護習慣">
          <div className="space-y-2">
            <FieldLabel>喝水方式</FieldLabel>
            <Pills options={['水碗', '滾珠水瓶']} value={formData.water_tool} onChange={set('water_tool')} />
          </div>
          <div className="space-y-2">
            <FieldLabel>餵食頻率</FieldLabel>
            <Pills options={['一天一次', '一天兩次']} value={formData.feed_frequency} onChange={set('feed_frequency')} />
          </div>
          <div className="space-y-2">
            <FieldLabel>主要牧草</FieldLabel>
            <Pills options={['提摩西', '苜蓿草', '果樹草/其他']} value={formData.hay_type} onChange={set('hay_type')} />
          </div>
          <label className="flex flex-col gap-1.5">
            <FieldLabel>自備物品與特殊照護</FieldLabel>
            <textarea rows="3" placeholder="飼料份量、草架、藥品、特殊習性……" className="w-full border-[1.5px] border-line rounded-xl px-3.5 py-3 bg-[#FFFDFA] text-ink placeholder:text-[#A8968A] focus:outline-none focus:border-carrot" value={formData.self_provided_items} onChange={(e) => set('self_provided_items')(e.target.value)} />
          </label>
        </Section>

        {/* 5 遠端看寶貝 */}
        <Section no="5" title="遠端看寶貝">
          <p className="text-sm text-bark leading-relaxed">住宿期間可以用米家 App 看即時畫面。想看的話請先下載米家，再填上你的米家 ID。</p>
          <Segmented
            value={wantsCamera ? 'yes' : 'no'}
            onChange={(v) => set('mi_home_id')(v === 'yes' ? '' : '不需要')}
            options={[{ value: 'yes', label: '我要看' }, { value: 'no', label: '不需要' }]}
          />
          {wantsCamera && (
            <label className="flex flex-col gap-1.5">
              <FieldLabel required>米家 ID</FieldLabel>
              <input required type="text" inputMode="numeric" placeholder="例：1234567890" className={inputClass} value={formData.mi_home_id} onChange={(e) => set('mi_home_id')(e.target.value)} />
            </label>
          )}
        </Section>
      </form>

      {/* 底部固定金額列 */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-[#EADBC8] shadow-[0_-6px_18px_rgba(59,42,32,.08)] z-40">
        <div className="max-w-xl mx-auto px-4 pt-3.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex items-center gap-3.5">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-bark truncate">
              {formData.pet_type} {count} 隻{count > 1 ? `・${formData.stay_type}` : ''}{hasDates ? `・${priceInfo.days} 天` : '・尚未選日期'}
            </div>
            <div className="text-2xl font-bold">{hasDates ? `$${priceInfo.total.toLocaleString()}` : '$—'}</div>
          </div>
          <button
            type="submit"
            form="booking-form"
            disabled={isFull}
            className="h-[52px] px-6 rounded-full bg-carrot text-white text-[17px] font-bold disabled:bg-[#CFC2B6] disabled:cursor-not-allowed"
          >
            {isFull ? '已客滿' : '送出預約'}
          </button>
        </div>
      </div>
    </div>
  );
}
