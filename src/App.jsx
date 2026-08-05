import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { RefreshCw, User, Package, Camera, Inbox, LayoutGrid, Calendar as CalendarIcon, Lock, Edit, Trash2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';

const ADMIN_PASSWORD = "8888"; // 店員後台預設密碼

export default function App() {
  const [viewMode, setViewMode] = useState('customer'); // 預設強制停留在顧客預約頁面
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [rooms, setRooms] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [showCheckInForm, setShowCheckInForm] = useState(false);
  const [assigningBooking, setAssigningBooking] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // 行事曆相關 state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDateBookings, setSelectedDateBookings] = useState(null);

  // 表單資料狀態
  const [formData, setFormData] = useState({
    owner_name: '',
    owner_phone: '',
    pet_name: '',
    pet_type: '兔子', // 兔子 / 龍貓 / 天竺鼠
    pet_count: '1',  // 1隻 / 2隻 / 3隻以上
    stay_type: 'single', // single: 獨住, same_cage: 擠同籠, multi_cage: 分開住
    pet_age: '',
    pet_gender: '公',
    is_neutered: '已絕育',
    check_in_date: '',
    check_out_date: '',
    water_tool: '水碗',
    feed_frequency: '一天兩次',
    hay_type: '提摩西',
    mi_home_id: '',
    self_provided_items: '',
    photo_urls: []
  });

  useEffect(() => {
    fetchRooms();
    fetchPendingBookings();
    fetchAllBookings();
  }, []);

  const fetchRooms = async () => {
    setLoading(true);
    const { data: roomsData, error } = await supabase
      .from('rooms')
      .select('*')
      .order('id', { ascending: true });
    if (!error) setRooms(roomsData || []);
    setLoading(false);
  };

  const fetchPendingBookings = async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });
    if (!error) setPendingBookings(data || []);
  };

  const fetchAllBookings = async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('check_in_date', { ascending: true });
    if (!error) setAllBookings(data || []);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdminUnlocked(true);
      setShowPasswordModal(false);
      setViewMode('admin');
      setPasswordInput('');
    } else {
      alert('密碼錯誤！');
    }
  };

  const handleRoomClick = async (room) => {
    setSelectedRoom(room);
    setShowCheckInForm(false);
    setCurrentBooking(null);

    if (room.status === 'OCCUPIED' && room.current_booking_id) {
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', room.current_booking_id)
        .single();
      if (!error) setCurrentBooking(booking);
    }
  };

  // 自動計價演算法 (白話加強版)
  const calculatePrice = () => {
    if (!formData.check_in_date || !formData.check_out_date) return { days: 0, totalPrice: 0, discountText: '' };
    
    const start = new Date(formData.check_in_date);
    const end = new Date(formData.check_out_date);
    const diffTime = end - start;
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (days <= 0) return { days: 0, totalPrice: 0, discountText: '退房日期需晚於入住日期' };

    const count = parseInt(formData.pet_count) || 1;
    let baseRate = 350; // 兔子與龍貓預設 350
    if (formData.pet_type === '天竺鼠') baseRate = 300;

    let discountRate = 1.0;
    let discountText = '原價計費';

    if (formData.pet_type === '天竺鼠') {
      if (days >= 5) { discountRate = 0.9; discountText = '滿 5 天享 9 折優惠'; }
    } else {
      if (days >= 10) { discountRate = 0.8; discountText = '滿 10 天享 8 折優惠'; }
      else if (days >= 5) { discountRate = 0.9; discountText = '滿 5 天享 9 折優惠'; }
    }

    let totalPrice = 0;

    if (count === 1 || formData.stay_type === 'multi_cage') {
      // 1隻 或 分開住不同籠（各自乘倍數）
      totalPrice = Math.round(baseRate * discountRate) * days * count;
    } else if (formData.stay_type === 'same_cage' && count > 1) {
      // 擠同一籠：主籠享折扣 + 陪同第2隻起每天 +100 (不打折)
      const mainPrice = Math.round(baseRate * discountRate) * days;
      const extraPrice = (count - 1) * 100 * days;
      totalPrice = mainPrice + extraPrice;
      discountText += ` (含同籠第2隻起每天+$100陪同費)`;
    }

    return { days, totalPrice, discountText };
  };

  const handleFileUpload = async (event) => {
    try {
      setUploading(true);
      const imageFile = event.target.files[0];
      if (!imageFile) return;

      const options = { maxSizeMB: 0.3, maxWidthOrHeight: 1200, useWebWorker: true };
      const compressedFile = await imageCompression(imageFile, options);

      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('pet-items')
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('pet-items').getPublicUrl(fileName);
      setFormData(prev => ({
        ...prev,
        photo_urls: [...prev.photo_urls, data.publicUrl]
      }));
      alert('照片已壓縮並上傳成功！');
    } catch (error) {
      alert('圖片上傳失敗：' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 顧客自主線上預約
  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    const priceInfo = calculatePrice();

    try {
      const combinedPetName = `${formData.pet_name} (${formData.pet_type} / ${formData.pet_count}隻 / ${
        formData.stay_type === 'same_cage' ? '擠同一籠' : formData.stay_type === 'multi_cage' ? '分開住不同籠' : '單獨住一籠'
      })`;

      const { error } = await supabase
        .from('bookings')
        .insert([
          {
            status: 'PENDING',
            room_id: null,
            owner_name: formData.owner_name,
            owner_phone: formData.owner_phone,
            pet_name: combinedPetName,
            pet_age: formData.pet_age,
            pet_gender: `${formData.pet_gender} (${formData.is_neutered})`,
            check_in_date: formData.check_in_date,
            check_out_date: formData.check_out_date,
            water_tool: formData.water_tool,
            feed_frequency: formData.feed_frequency,
            hay_type: formData.hay_type,
            mi_home_id: formData.mi_home_id,
            self_provided_items: { 
              details: formData.self_provided_items,
              estimated_days: priceInfo.days,
              estimated_price: priceInfo.totalPrice,
              discount_note: priceInfo.discountText
            },
            photo_urls: []
          }
        ]);

      if (error) throw error;
      alert('🎉 預約單已成功送出！現場點交時店員將協助您完成入住。');
      
      setFormData({
        owner_name: '', owner_phone: '', pet_name: '', pet_type: '兔子', pet_count: '1', stay_type: 'single', pet_age: '',
        pet_gender: '公', is_neutered: '已絕育', check_in_date: '', check_out_date: '',
        water_tool: '水碗', feed_frequency: '一天兩次', hay_type: '提摩西',
        mi_home_id: '', self_provided_items: '', photo_urls: []
      });

      fetchPendingBookings();
      fetchAllBookings();
    } catch (err) {
      alert('預約失敗：' + err.message);
    }
  };

  // 指派預約至籠位 (帶有防呆機制)
  const handleAssignRoom = async (bookingId, targetRoomId) => {
    const targetRoom = rooms.find(r => r.id === targetRoomId);
    if (targetRoom && targetRoom.status === 'OCCUPIED') {
      alert(`⚠️ 警告：籠位 ${targetRoomId} 號目前已有住客入住！無法指派至此籠位。`);
      return;
    }

    try {
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          status: 'CONFIRMED',
          room_id: targetRoomId,
          photo_urls: formData.photo_urls
        })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      await supabase
        .from('rooms')
        .update({ status: 'OCCUPIED', current_booking_id: bookingId })
        .eq('id', targetRoomId);

      alert(`成功指派至籠位 ${targetRoomId} 號，完成入住！`);
      setAssigningBooking(null);
      fetchRooms();
      fetchPendingBookings();
      fetchAllBookings();
    } catch (err) {
      alert('指派失敗：' + err.message);
    }
  };

  // 辦理退房點收
  const handleCheckOut = async () => {
    if (!window.confirm(`確定要為籠位 ${selectedRoom.id} 辦理退房點收嗎？(系統將清理照片)`)) return;

    try {
      if (currentBooking?.photo_urls?.length > 0) {
        const filesToDelete = currentBooking.photo_urls.map(url => url.split('/').pop());
        await supabase.storage.from('pet-items').remove(filesToDelete);
      }

      await supabase
        .from('rooms')
        .update({ status: 'VACANT', current_booking_id: null })
        .eq('id', selectedRoom.id);

      alert(`籠位 ${selectedRoom.id} 已順利退房！`);
      setSelectedRoom(null);
      fetchRooms();
      fetchAllBookings();
    } catch (err) {
      alert('退房失敗：' + err.message);
    }
  };

  // 刪除預約單
  const handleDeleteBooking = async (bookingId) => {
    if (!window.confirm('確定要刪除此筆預約嗎？此操作無法復原。')) return;
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
      if (error) throw error;
      alert('預約已刪除！');
      fetchAllBookings();
      fetchPendingBookings();
      setSelectedDateBookings(null);
    } catch (err) {
      alert('刪除失敗：' + err.message);
    }
  };

  // 編輯與儲存預約單
  const handleUpdateBooking = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          owner_name: editingBooking.owner_name,
          owner_phone: editingBooking.owner_phone,
          pet_name: editingBooking.pet_name,
          check_in_date: editingBooking.check_in_date,
          check_out_date: editingBooking.check_out_date
        })
        .eq('id', editingBooking.id);

      if (error) throw error;
      alert('預約更新成功！');
      setEditingBooking(null);
      fetchAllBookings();
      setSelectedDateBookings(null);
    } catch (err) {
      alert('更新失敗：' + err.message);
    }
  };

  // 行事曆天數算格邏輯 (包含每日籠數統計)
  const renderCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50 border border-slate-100 rounded-xl opacity-40"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayBookings = allBookings.filter(b => {
        return dateString >= b.check_in_date && dateString <= b.check_out_date;
      });

      // 算籠數量：若寵物名字中包含「擠同一籠」，多隻算 1 籠；若「分開住不同籠」，依隻數計算籠數
      let usedCagesCount = 0;
      dayBookings.forEach(b => {
        if (b.pet_name.includes('分開住不同籠')) {
          if (b.pet_name.includes('2隻')) usedCagesCount += 2;
          else if (b.pet_name.includes('3隻')) usedCagesCount += 3;
          else usedCagesCount += 1;
        } else {
          usedCagesCount += 1; // 單獨住或擠同一籠都只佔 1 籠
        }
      });

      days.push(
        <div
          key={day}
          onClick={() => setSelectedDateBookings({ date: dateString, bookings: dayBookings })}
          className={`h-24 p-2 border rounded-xl cursor-pointer transition flex flex-col justify-between ${
            dayBookings.length > 0 ? 'bg-amber-50/50 border-amber-200 hover:border-amber-400' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-700 text-sm">{day}</span>
            {usedCagesCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                佔用 {usedCagesCount} 籠
              </span>
            )}
          </div>
          <div className="text-[11px] space-y-1 overflow-hidden">
            {dayBookings.slice(0, 2).map((b, idx) => (
              <div key={idx} className="truncate bg-white/80 p-0.5 rounded border border-amber-100 text-amber-900">
                🐾 {b.pet_name.split(' ')[0]}
              </div>
            ))}
            {dayBookings.length > 2 && (
              <div className="text-[10px] text-slate-400 font-bold">+還有 {dayBookings.length - 2} 筆</div>
            )}
          </div>
        </div>
      );
    }
    return days;
  };

  const calculated = calculatePrice();

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-12">
      {/* 頂部 Header */}
      <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐰</span>
          <h1 className="text-xl font-bold tracking-wide">糰子兔 - 住宿預約與管理系統</h1>
        </div>

        <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700">
          {!isAdminUnlocked ? (
            <button
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition"
            >
              <Lock size={14} /> 店員登入通道
            </button>
          ) : (
            <>
              <button
                onClick={() => setViewMode('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'admin' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid size={14} /> 店員管理看板
              </button>

              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'calendar' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <CalendarIcon size={14} /> 預約行事曆
              </button>

              <button
                onClick={() => setViewMode('customer')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'customer' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                📝 顧客預約視角
              </button>
            </>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-6 px-4">
        {/* ----------------- 視圖 1：顧客線上自主預約表單 ----------------- */}
        {viewMode === 'customer' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">🐰 糰子兔 - 線上住宿預約單</h2>
              <p className="text-slate-500 text-xs mt-1">請填寫預約資料與照護習慣，現場點交時店員將協助您完成入住！</p>
            </div>

            <form onSubmit={handleCustomerSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">飼主姓名 *</label>
                  <input required type="text" className="w-full border rounded-xl p-2.5 bg-slate-50 focus:bg-white" value={formData.owner_name} onChange={e => setFormData({...formData, owner_name: e.target.value})} placeholder="請輸入姓名" />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">飼主電話 *</label>
                  <input required type="text" className="w-full border rounded-xl p-2.5 bg-slate-50 focus:bg-white" value={formData.owner_phone} onChange={e => setFormData({...formData, owner_phone: e.target.value})} placeholder="請輸入手機號碼" />
                </div>
              </div>

              {/* 寵物種類與隻數選單 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">寵物種類 *</label>
                  <select className="w-full border rounded-xl p-2.5 bg-slate-50" value={formData.pet_type} onChange={e => setFormData({...formData, pet_type: e.target.value})}>
                    <option value="兔子">🐰 兔子</option>
                    <option value="龍貓">🐭 龍貓</option>
                    <option value="天竺鼠">🐹 天竺鼠</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">入住隻數 *</label>
                  <select className="w-full border rounded-xl p-2.5 bg-slate-50" value={formData.pet_count} onChange={e => setFormData({...formData, pet_count: e.target.value, stay_type: e.target.value === '1' ? 'single' : 'same_cage'})}>
                    <option value="1">1 隻</option>
                    <option value="2">2 隻</option>
                    <option value="3">3 隻以上</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">入住方式 *</label>
                  {formData.pet_count === '1' ? (
                    <input disabled type="text" value="🏠 單獨住一籠" className="w-full border rounded-xl p-2.5 bg-slate-100 text-slate-500 font-bold" />
                  ) : (
                    <select className="w-full border rounded-xl p-2.5 bg-emerald-50 border-emerald-300 font-bold text-emerald-900" value={formData.stay_type} onChange={e => setFormData({...formData, stay_type: e.target.value})}>
                      <option value="same_cage">👨‍👩‍👧 擠同一籠 (第2隻起+$100/天)</option>
                      <option value="multi_cage">🚪 分開住不同籠 (獨立計費)</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-slate-700 font-bold mb-1">寵物名字 *</label>
                  <input required type="text" className="w-full border rounded-xl p-2.5 bg-slate-50 focus:bg-white" value={formData.pet_name} onChange={e => setFormData({...formData, pet_name: e.target.value})} placeholder="例如：糰子" />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">寵物性別 *</label>
                  <select className="w-full border rounded-xl p-2.5 bg-slate-50" value={formData.pet_gender} onChange={e => setFormData({...formData, pet_gender: e.target.value})}>
                    <option value="公">公</option>
                    <option value="母">母</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">是否絕育 *</label>
                  <select className="w-full border rounded-xl p-2.5 bg-slate-50" value={formData.is_neutered} onChange={e => setFormData({...formData, is_neutered: e.target.value})}>
                    <option value="已絕育">已絕育</option>
                    <option value="未絕育">未絕育</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">預計入住日期 *</label>
                  <input required type="date" className="w-full border rounded-xl p-2.5 bg-slate-50" value={formData.check_in_date} onChange={e => setFormData({...formData, check_in_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">預計退房日期 *</label>
                  <input required type="date" className="w-full border rounded-xl p-2.5 bg-slate-50" value={formData.check_out_date} onChange={e => setFormData({...formData, check_out_date: e.target.value})} />
                </div>
              </div>

              {/* 即時費用與天數試算卡片 */}
              {calculated.days > 0 && (
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 flex justify-between items-center text-emerald-950">
                  <div>
                    <div className="text-xs text-emerald-700 font-bold">預估預約天數與折扣</div>
                    <div className="text-lg font-black">{calculated.days} 天 <span className="text-xs font-normal bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full ml-1">{calculated.discountText}</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-emerald-700 font-bold">預估費用總計</div>
                    <div className="text-2xl font-black text-emerald-700">${calculated.totalPrice} 元</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">飲水習慣</label>
                  <select className="w-full border rounded-xl p-2.5 bg-slate-50" value={formData.water_tool} onChange={e => setFormData({...formData, water_tool: e.target.value})}>
                    <option value="水碗">水碗</option>
                    <option value="滾珠水瓶">滾珠水瓶</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">飼料頻率</label>
                  <select className="w-full border rounded-xl p-2.5 bg-slate-50" value={formData.feed_frequency} onChange={e => setFormData({...formData, feed_frequency: e.target.value})}>
                    <option value="一天一次">一天一次</option>
                    <option value="一天兩次">一天兩次</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">主食牧草</label>
                  <select className="w-full border rounded-xl p-2.5 bg-slate-50" value={formData.hay_type} onChange={e => setFormData({...formData, hay_type: e.target.value})}>
                    <option value="提摩西">提摩西</option>
                    <option value="苜蓿草">苜蓿草</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">自備物品清單與注意事項</label>
                <textarea rows="3" className="w-full border rounded-xl p-2.5 bg-slate-50 focus:bg-white" value={formData.self_provided_items} onChange={e => setFormData({...formData, self_provided_items: e.target.value})} placeholder="例如：自備飼料一包、保健品每日一錠、害怕雷聲" />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">米家攝影機 ID (選填)</label>
                <input type="text" className="w-full border rounded-xl p-2.5 bg-slate-50" value={formData.mi_home_id} onChange={e => setFormData({...formData, mi_home_id: e.target.value})} placeholder="供主人連線監視器使用" />
              </div>

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition text-base shadow-sm mt-2">
                確認並送出預約單
              </button>
            </form>
          </div>
        )}

        {/* ----------------- 視圖 2：店員管理後台看板 ----------------- */}
        {viewMode === 'admin' && isAdminUnlocked && (
          <div className="space-y-6">
            {/* 📥 待派房暫存區 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Inbox className="text-amber-500" size={18} /> 📥 待派房預約暫存區 ({pendingBookings.length})
                </h2>
                <button onClick={fetchPendingBookings} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-bold">
                  <RefreshCw size={12} /> 刷新最新預約
                </button>
              </div>

              {pendingBookings.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">目前沒有等待派房的線上預約單。</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingBookings.map((b) => (
                    <div key={b.id} className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 space-y-2 text-xs">
                      <div className="flex justify-between font-bold text-amber-900">
                        <span>🐾 {b.pet_name}</span>
                        <span className="text-amber-700">{b.pet_gender}</span>
                      </div>
                      <div className="text-slate-600">飼主: {b.owner_name} ({b.owner_phone})</div>
                      <div className="text-slate-500">預計時間：{b.check_in_date} ~ {b.check_out_date}</div>
                      <div className="text-slate-500 truncate">自備物: {b.self_provided_items?.details || '無'}</div>
                      {b.self_provided_items?.estimated_price && (
                        <div className="text-emerald-700 font-bold">預估費用: ${b.self_provided_items.estimated_price} 元</div>
                      )}
                      <button
                        onClick={() => setAssigningBooking(b)}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 rounded-lg transition mt-1"
                      >
                        現場點交拍照並派房
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 🏠 20 個籠位看板 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <LayoutGrid className="text-emerald-600" size={18} /> 🏠 20 籠位即時狀態
                </h2>
                <button onClick={fetchRooms} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-bold">
                  <RefreshCw size={12} /> 重新整理
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12 text-slate-400 text-sm">載入籠位資訊中...</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {rooms.map((room) => {
                    const isOccupied = room.status === 'OCCUPIED';
                    // 比對同電話其他籠位
                    const currentRoomBooking = allBookings.find(b => b.id === room.current_booking_id);
                    const sameOwnerOtherRooms = isOccupied && currentRoomBooking ? rooms.filter(r => {
                      if (r.id === room.id || r.status !== 'OCCUPIED') return false;
                      const b = allBookings.find(bk => bk.id === r.current_booking_id);
                      return b && b.owner_phone === currentRoomBooking.owner_phone;
                    }) : [];

                    return (
                      <div
                        key={room.id}
                        onClick={() => handleRoomClick(room)}
                        className={`cursor-pointer rounded-2xl p-3.5 border-2 transition-all flex flex-col justify-between h-32 ${
                          isOccupied ? 'bg-rose-50/70 border-rose-200 hover:border-rose-400' : 'bg-white border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-700 text-xs">籠位 {String(room.id).padStart(2, '0')}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isOccupied ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                              {isOccupied ? '入住中' : '空房'}
                            </span>
                          </div>

                          {/* 直覺顯示資訊：飼主姓名、電話與寵物名字 */}
                          {isOccupied && currentRoomBooking && (
                            <div className="mt-1 space-y-0.5 text-left">
                              <div className="font-bold text-rose-950 text-xs truncate">🐾 {currentRoomBooking.pet_name.split(' ')[0]}</div>
                              <div className="text-[11px] text-slate-600 truncate">👤 {currentRoomBooking.owner_name} ({currentRoomBooking.owner_phone.slice(-4)})</div>
                              {sameOwnerOtherRooms.length > 0 && (
                                <div className="text-[9px] bg-amber-200 text-amber-900 px-1 rounded font-bold inline-block">
                                  同飼主另有 {sameOwnerOtherRooms.map(r => `#${r.id}`).join(', ')} 籠
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="text-[10px] font-bold text-slate-400 text-right mt-1">
                          {isOccupied ? '點擊查看詳情 ➔' : '+ 點擊指派'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------- 視圖 3：預約行事曆 ----------------- */}
        {viewMode === 'calendar' && isAdminUnlocked && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CalendarIcon className="text-amber-500" /> 🗓️ 預約總覽行事曆
              </h2>
              <div className="flex items-center gap-3">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="text-slate-600 hover:text-slate-900 font-bold px-2 py-1 bg-slate-100 rounded-lg">◀ 上個月</button>
                <span className="font-bold text-slate-800 text-base">{currentMonth.getFullYear()} 年 {currentMonth.getMonth() + 1} 月</span>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="text-slate-600 hover:text-slate-900 font-bold px-2 py-1 bg-slate-100 rounded-lg">下個月 ▶</button>
              </div>
            </div>

            {/* 星期 Header */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400">
              <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
            </div>

            {/* 日曆網格 */}
            <div className="grid grid-cols-7 gap-2">
              {renderCalendarDays()}
            </div>
          </div>
        )}
      </main>

      {/* ----------------- 彈窗 1：店員解鎖登入 ----------------- */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl space-y-4">
            <h3 className="font-bold text-slate-800 text-center text-base">🔒 店員後台解鎖</h3>
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <input
                type="password"
                placeholder="請輸入店員解鎖密碼"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                className="w-full border rounded-xl p-2.5 text-center text-sm font-bold bg-slate-50 focus:bg-white"
                autoFocus
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="w-1/2 bg-slate-100 text-slate-600 font-bold py-2 rounded-xl text-xs">取消</button>
                <button type="submit" className="w-1/2 bg-amber-500 text-slate-950 font-bold py-2 rounded-xl text-xs">解鎖進入</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- 彈窗 2：店員現場點交與派房 ----------------- */}
      {assigningBooking && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base">現場點交拍照與分配籠位</h3>
              <button onClick={() => setAssigningBooking(null)} className="text-slate-400 font-bold">✕</button>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl text-xs space-y-1 text-amber-900">
              <div className="font-bold">🐾 寵物: {assigningBooking.pet_name} ({assigningBooking.pet_gender})</div>
              <div>👤 飼主: {assigningBooking.owner_name} ({assigningBooking.owner_phone})</div>
              <div>📅 日期: {assigningBooking.check_in_date} ~ {assigningBooking.check_out_date}</div>
              <div>📦 客人填寫的備註: {assigningBooking.self_provided_items?.details || '無'}</div>
            </div>

            {/* 現場拍照功能 */}
            <div>
              <label className="block text-slate-700 font-bold mb-1 text-xs">現場拍攝物品照片 (自動壓縮照片)</label>
              <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="w-full text-xs" />
              {uploading && <div className="text-xs text-amber-600 font-bold mt-1">照片上傳中...</div>}
              {formData.photo_urls.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto">
                  {formData.photo_urls.map((url, idx) => (
                    <img key={idx} src={url} alt="物品" className="w-16 h-16 object-cover rounded-lg border" />
                  ))}
                </div>
              )}
            </div>

            {/* 選擇籠位 (只顯示空籠) */}
            <div>
              <label className="block text-slate-700 font-bold mb-2 text-xs">點擊選擇要分配的空籠：</label>
              <div className="grid grid-cols-4 gap-2">
                {rooms.filter(r => r.status === 'VACANT').map(r => (
                  <button
                    key={r.id}
                    onClick={() => handleAssignRoom(assigningBooking.id, r.id)}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold p-2.5 rounded-xl border border-emerald-200 text-xs transition"
                  >
                    籠位 {String(r.id).padStart(2, '0')}
                  </button>
                ))}
              </div>
              {rooms.filter(r => r.status === 'VACANT').length === 0 && (
                <div className="text-xs text-rose-500 font-bold text-center py-2">目前全店爆滿無空籠，請先辦理退房。</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- 彈窗 3：籠位住客詳情（已加回自備物品與注意事項備註！） ----------------- */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base">籠位 {String(selectedRoom.id).padStart(2, '0')} 號住客詳情</h3>
              <button onClick={() => setSelectedRoom(null)} className="text-slate-400 font-bold text-lg">✕</button>
            </div>

            {selectedRoom.status === 'OCCUPIED' && currentBooking ? (
              <div className="space-y-3 text-xs">
                {/* 寵物基本資料 */}
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 space-y-1">
                  <div className="text-sm font-bold text-rose-950">🐾 寵物：{currentBooking.pet_name}</div>
                  <div className="text-rose-800 font-medium">性別/絕育：{currentBooking.pet_gender}</div>
                  <div className="text-rose-800 font-medium">年齡：{currentBooking.pet_age || '未填寫'}</div>
                </div>

                {/* 飼主聯絡資訊 */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-slate-700">
                  <div className="font-bold">👤 飼主：{currentBooking.owner_name} ({currentBooking.owner_phone})</div>
                  <div>📅 住宿時間：{currentBooking.check_in_date} ~ {currentBooking.check_out_date}</div>
                  {currentBooking.mi_home_id && <div className="text-emerald-700 font-bold">📷 米家 ID: {currentBooking.mi_home_id}</div>}
                </div>

                {/* 照護習慣與細節 */}
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-1 text-amber-900">
                  <div className="font-bold border-b border-amber-200 pb-1 mb-1">🥣 照顧習慣設定：</div>
                  <div>• 飲水工具：{currentBooking.water_tool}</div>
                  <div>• 餵食頻率：{currentBooking.feed_frequency}</div>
                  <div>• 主食牧草：{currentBooking.hay_type}</div>
                </div>

                {/* 🌟 修正重點：清楚展示自備物品與客人注意事項備註 */}
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 space-y-1 text-blue-900">
                  <div className="font-bold border-b border-blue-200 pb-1 mb-1 flex items-center gap-1">
                    <Package size={14} /> 🧳 自備物品與注意事項備註：
                  </div>
                  <div className="text-xs whitespace-pre-wrap leading-relaxed">
                    {currentBooking.self_provided_items?.details || '無特別備註內容'}
                  </div>
                </div>

                {/* 拍攝的照片 */}
                {currentBooking.photo_urls?.length > 0 && (
                  <div>
                    <div className="font-bold text-slate-700 mb-1 flex items-center gap-1"><Camera size={14} /> 點交物品照片：</div>
                    <div className="flex gap-2 overflow-x-auto">
                      {currentBooking.photo_urls.map((url, idx) => (
                        <img key={idx} src={url} alt="物品照片" className="w-20 h-20 object-cover rounded-xl border" />
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleCheckOut}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl transition text-xs shadow-sm mt-2"
                >
                  辦理退房點收 (系統將自動清理照片)
                </button>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs font-bold">
                此籠位目前為空房。請至「待派房預約暫存區」進行指派入住。
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------- 彈窗 4：行事曆點擊日期明細與修改/刪除 ----------------- */}
      {selectedDateBookings && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base">📅 {selectedDateBookings.date} 預約名單</h3>
              <button onClick={() => setSelectedDateBookings(null)} className="text-slate-400 font-bold">✕</button>
            </div>

            {selectedDateBookings.bookings.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">當日無任何住客與預約。</div>
            ) : (
              <div className="space-y-2">
                {selectedDateBookings.bookings.map(b => (
                  <div key={b.id} className="bg-slate-50 p-3 rounded-xl border flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-slate-800">🐾 {b.pet_name}</div>
                      <div className="text-slate-500">飼主: {b.owner_name} ({b.owner_phone})</div>
                      <div className="text-slate-400 text-[10px]">{b.check_in_date} ~ {b.check_out_date}</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditingBooking(b)} className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleDeleteBooking(b.id)} className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------- 彈窗 5：編輯預約單 ----------------- */}
      {editingBooking && (
        <div className="fixed inset-0 bg-slate-900/60 flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-3">
            <h3 className="font-bold text-slate-800 text-base">✏️ 修改預約資料</h3>
            <form onSubmit={handleUpdateBooking} className="space-y-2 text-xs">
              <div>
                <label className="block font-bold text-slate-600">飼主姓名</label>
                <input type="text" className="w-full border rounded-lg p-2" value={editingBooking.owner_name} onChange={e => setEditingBooking({...editingBooking, owner_name: e.target.value})} />
              </div>
              <div>
                <label className="block font-bold text-slate-600">飼主電話</label>
                <input type="text" className="w-full border rounded-lg p-2" value={editingBooking.owner_phone} onChange={e => setEditingBooking({...editingBooking, owner_phone: e.target.value})} />
              </div>
              <div>
                <label className="block font-bold text-slate-600">寵物名稱與資訊</label>
                <input type="text" className="w-full border rounded-lg p-2" value={editingBooking.pet_name} onChange={e => setEditingBooking({...editingBooking, pet_name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-600">入住日期</label>
                  <input type="date" className="w-full border rounded-lg p-2" value={editingBooking.check_in_date} onChange={e => setEditingBooking({...editingBooking, check_in_date: e.target.value})} />
                </div>
                <div>
                  <label className="block font-bold text-slate-600">退房日期</label>
                  <input type="date" className="w-full border rounded-lg p-2" value={editingBooking.check_out_date} onChange={e => setEditingBooking({...editingBooking, check_out_date: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditingBooking(null)} className="w-1/2 bg-slate-100 text-slate-600 font-bold py-2 rounded-xl">取消</button>
                <button type="submit" className="w-1/2 bg-amber-500 text-slate-950 font-bold py-2 rounded-xl">儲存修改</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
