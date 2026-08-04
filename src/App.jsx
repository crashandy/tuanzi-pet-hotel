import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { RefreshCw, Plus, User, Package, Camera, Inbox, LayoutGrid, Calendar as CalendarIcon, Lock, Unlock, Edit3, Trash2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';

const ADMIN_PASSWORD = '9358'; // 店員解鎖密碼

export default function App() {
  // 權限與頁面模式
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [viewMode, setViewMode] = useState('customer'); // 預設開啟「顧客預約」

  // 資料狀態
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]); // 正式預約 (CONFIRMED)
  const [pendingBookings, setPendingBookings] = useState([]); // 📥 待派房暫存列表
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [showCheckInForm, setShowCheckInForm] = useState(false);
  const [assigningBooking, setAssigningBooking] = useState(null); // 當前正在分配籠位的暫存預約
  const [editingBooking, setEditingBooking] = useState(null); // 當前正在編輯的預約單

  // 行事曆相關
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedDateBookings, setSelectedDateBookings] = useState(null); // 點擊當日彈窗

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // 表單資料狀態
  const [formData, setFormData] = useState({
    pet_type: '兔子', // 兔子 / 龍貓 / 天竺鼠
    pet_count: '1', // 1隻 / 2隻 / 3隻以上
    stay_type: '單獨住一籠', // 單獨住一籠 / 擠同一籠 / 分開住不同籠
    owner_name: '',
    owner_phone: '',
    pet_name: '',
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
    fetchBookings();
    fetchPendingBookings();
  }, []);

  // 抓取籠位
  const fetchRooms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('id', { ascending: true });
    if (!error) setRooms(data || []);
    setLoading(false);
  };

  // 抓取所有已確認預約 (給行事曆與關聯查詢使用)
  const fetchBookings = async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('status', 'CONFIRMED');
    if (!error) setBookings(data || []);
  };

  // 抓取待派房的暫存預約 (status = 'PENDING')
  const fetchPendingBookings = async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });
    if (!error) setPendingBookings(data || []);
  };

  // 點擊籠位
  const handleRoomClick = async (room) => {
    setSelectedRoom(room);
    setShowCheckInForm(false);
    setCurrentBooking(null);

    if (room.status === 'OCCUPIED' && room.current_booking_id) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', room.current_booking_id)
        .single();
      if (booking) setCurrentBooking(booking);
    }
  };

  // 密碼解鎖驗證
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdminUnlocked(true);
      setShowPasswordModal(false);
      setViewMode('admin');
      setPasswordInput('');
    } else {
      alert('密碼錯誤！請重新輸入。');
    }
  };

  // 精算住宿金額邏輯
  const calculateEstimate = () => {
    if (!formData.check_in_date || !formData.check_out_date) return null;

    const start = new Date(formData.check_in_date);
    const end = new Date(formData.check_out_date);
    const diffTime = end - start;
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (days <= 0) return { days: 0, totalPrice: 0, note: '退房日期需晚於入住日期' };

    const count = parseInt(formData.pet_count) || 1;
    let baseRate = formData.pet_type === '天竺鼠' ? 300 : 350;

    // 計算打折係數 (天竺鼠最多5天9折，兔子/龍貓滿10天8折)
    let discount = 1.0;
    if (days >= 10 && formData.pet_type !== '天竺鼠') {
      discount = 0.8;
    } else if (days >= 5) {
      discount = 0.9;
    }

    let totalPrice = 0;
    let note = '';

    if (count === 1) {
      totalPrice = baseRate * discount * days;
      note = discount < 1 ? `單隻住宿享 ${discount * 10} 折優惠` : '原價計算';
    } else if (formData.stay_type === '👨‍👩‍👧 擠同一籠（第二隻起每天+$100，不打折）') {
      const mainPetCost = baseRate * discount * days;
      const extraPetCost = (count - 1) * 100 * days; // 第二隻起每天+$100不打折
      totalPrice = mainPetCost + extraPetCost;
      note = `主籠住宿費 ($${baseRate * discount}/天) + 陪伴費 ($100/隻/天)`;
    } else {
      // 分開住不同籠
      totalPrice = count * (baseRate * discount) * days;
      note = discount < 1 ? `每隻均享 ${discount * 10} 折優惠 (分住 ${count} 籠)` : `每隻原價計算 (分住 ${count} 籠)`;
    }

    return { days, totalPrice, note };
  };

  const estimate = calculateEstimate();

  // 圖片壓縮上傳
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
      alert('照片已自動壓縮並上傳成功！');
    } catch (error) {
      alert('圖片上傳失敗：' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 顧客線上自主預約
  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    try {
      const fullPetName = `${formData.pet_name} (${formData.pet_type} / ${formData.pet_count}隻 / ${formData.stay_type})`;
      const pricingDetails = estimate ? `住宿${estimate.days}天，估算金額：$${estimate.totalPrice}元 (${estimate.note})` : '';

      const { error } = await supabase
        .from('bookings')
        .insert([{
          status: 'PENDING',
          room_id: null,
          owner_name: formData.owner_name,
          owner_phone: formData.owner_phone,
          pet_name: fullPetName,
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
            pricing: pricingDetails
          },
          photo_urls: []
        }]);

      if (error) throw error;
      alert('🎉 預約單已成功送出！請於入住當天至現場由店員為您點收物品與安排籠位。');

      setFormData({
        pet_type: '兔子', pet_count: '1', stay_type: '單獨住一籠',
        owner_name: '', owner_phone: '', pet_name: '', pet_age: '',
        pet_gender: '公', is_neutered: '已絕育', check_in_date: '', check_out_date: '',
        water_tool: '水碗', feed_frequency: '一天兩次', hay_type: '提摩西',
        mi_home_id: '', self_provided_items: '', photo_urls: []
      });
      fetchPendingBookings();
    } catch (err) {
      alert('預約失敗：' + err.message);
    }
  };

  // 店員現場直接辦理入住
  const handleCheckInSubmit = async (e) => {
    e.preventDefault();
    try {
      const fullPetName = `${formData.pet_name} (${formData.pet_type} / ${formData.pet_count}隻 / ${formData.stay_type})`;
      const pricingDetails = estimate ? `住宿${estimate.days}天，估算金額：$${estimate.totalPrice}元 (${estimate.note})` : '';

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert([{
          status: 'CONFIRMED',
          room_id: selectedRoom.id,
          owner_name: formData.owner_name,
          owner_phone: formData.owner_phone,
          pet_name: fullPetName,
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
            pricing: pricingDetails
          },
          photo_urls: formData.photo_urls
        }])
        .select()
        .single();

      if (bookingError) throw bookingError;

      await supabase
        .from('rooms')
        .update({ status: 'OCCUPIED', current_booking_id: bookingData.id })
        .eq('id', selectedRoom.id);

      alert(`籠位 ${selectedRoom.id} 號辦理入住成功！`);
      setShowCheckInForm(false);
      setSelectedRoom(null);
      fetchRooms();
      fetchBookings();
    } catch (err) {
      alert('入住失敗：' + err.message);
    }
  };

  // 修改 1：指派暫存預約至空籠 (加上防呆提示，若目標籠位已被佔用則不執行)
  const handleAssignRoom = async (bookingId, targetRoomId) => {
    // 檢查目標籠位狀態
    const targetRoom = rooms.find(r => r.id === targetRoomId);
    if (targetRoom && targetRoom.status === 'OCCUPIED') {
      alert(`⚠️ 動作被阻擋：籠位 ${targetRoomId} 號目前已有住客入住中，無法指派此籠位！`);
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
      fetchBookings();
      fetchPendingBookings();
    } catch (err) {
      alert('指派失敗：' + err.message);
    }
  };

  // 辦理退房
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
      fetchBookings();
    } catch (err) {
      alert('退房失敗：' + err.message);
    }
  };

  // 修改與刪除預約 (行事曆內使用)
  const handleDeleteBooking = async (bookingId) => {
    if (!window.confirm('確定要刪除這筆預約單嗎？')) return;
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
      if (error) throw error;
      alert('預約已刪除！');
      fetchBookings();
      fetchPendingBookings();
      if (selectedDateBookings) {
        setSelectedDateBookings(prev => ({
          ...prev,
          list: prev.list.filter(b => b.id !== bookingId)
        }));
      }
    } catch (err) {
      alert('刪除失敗：' + err.message);
    }
  };

  const handleUpdateBookingSubmit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          owner_name: editingBooking.owner_name,
          owner_phone: editingBooking.owner_phone,
          pet_name: editingBooking.pet_name,
          check_in_date: editingBooking.check_in_date,
          check_out_date: editingBooking.check_out_date,
          water_tool: editingBooking.water_tool,
          feed_frequency: editingBooking.feed_frequency,
          hay_type: editingBooking.hay_type,
          mi_home_id: editingBooking.mi_home_id
        })
        .eq('id', editingBooking.id);

      if (error) throw error;
      alert('預約資料已成功修改！');
      setEditingBooking(null);
      fetchBookings();
      fetchPendingBookings();
    } catch (err) {
      alert('修改失敗：' + err.message);
    }
  };

  // 修改 2：計算當日預估佔用的「籠位數量」(非隻數)
  const getOccupiedRoomsForDate = (dateString) => {
    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0);

    // 篩選出當日在住的有效預約
    const activeBookings = bookings.filter(b => {
      const start = new Date(b.check_in_date);
      const end = new Date(b.check_out_date);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return targetDate >= start && targetDate <= end;
    });

    // 計算實際佔用的籠位數：
    // 若寵物同住一籠，則算作 1 籠；若資料內有寫分籠或隻數，可以按籠數累加
    let totalRoomsOccupied = 0;
    activeBookings.forEach(b => {
      if (b.pet_name && b.pet_name.includes('分開住不同籠')) {
        // 從名字提取隻數 (例：2隻 / 分開住不同籠 => 佔用 2 籠)
        const match = b.pet_name.match(/(\d+)隻/);
        const count = match ? parseInt(match[1]) : 1;
        totalRoomsOccupied += count;
      } else {
        // 單獨一籠或擠同一籠均佔用 1 籠
        totalRoomsOccupied += 1;
      }
    });

    return { totalRoomsOccupied, activeBookings };
  };

  // 產生行事曆日期陣列
  const generateCalendarDays = () => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const days = [];
    const startDayOfWeek = firstDayOfMonth.getDay();

    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, dateStr });
    }

    return days;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      {/* 頂部 Header & 權限防護通道 */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐰</span>
            <h1 className="text-xl font-bold tracking-wide">糰子兔 - 住宿管理系統</h1>
          </div>

          <div className="flex items-center gap-2">
            {isAdminUnlocked ? (
              <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                <button
                  onClick={() => setViewMode('admin')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    viewMode === 'admin' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" /> 看板
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    viewMode === 'calendar' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CalendarIcon className="w-4 h-4" /> 行事曆
                </button>
                <button
                  onClick={() => setViewMode('customer')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    viewMode === 'customer' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📝 顧客表單
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition"
              >
                <Lock className="w-3.5 h-3.5" /> 店員專用通道
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 解鎖密碼彈窗 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-1">店員權限驗證</h3>
            <p className="text-xs text-slate-500 mb-4">請輸入後台解鎖密碼以開啟管理看板與行事曆</p>
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <input
                type="password"
                placeholder="請輸入密碼"
                className="w-full border rounded-xl p-2.5 text-center font-bold tracking-widest focus:ring-2 focus:ring-amber-400 outline-none"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="w-1/2 bg-slate-100 text-slate-600 font-bold py-2 rounded-xl text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-xl text-xs transition"
                >
                  驗證解鎖
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 mt-6">
        {/* ----------------- 視圖 1：店員管理後台 ----------------- */}
        {viewMode === 'admin' && isAdminUnlocked && (
          <div className="space-y-6">
            {/* 📥 待派房暫存區 ( Pending Inbox ) */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-amber-500" />
                  <h2 className="font-bold text-slate-800">📥 待派房預約暫存區 ({pendingBookings.length})</h2>
                </div>
                <button
                  onClick={fetchPendingBookings}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg"
                >
                  <RefreshCw className="w-3 h-3" /> 刷新最新預約
                </button>
              </div>

              {pendingBookings.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  目前沒有等待派房的線上預約單。
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingBookings.map((b) => (
                    <div key={b.id} className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-800 text-sm">🐾 {b.pet_name}</span>
                        <span className="bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">待派房</span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1">
                        <p>飼主: <span className="font-semibold text-slate-800">{b.owner_name}</span> ({b.owner_phone})</p>
                        <p>預計時間：<span className="font-medium text-slate-700">{b.check_in_date} ~ {b.check_out_date}</span></p>
                        {b.self_provided_items?.pricing && (
                          <p className="text-emerald-700 font-bold bg-emerald-100/60 p-1 rounded text-[11px]">
                            💰 {b.self_provided_items.pricing}
                          </p>
                        )}
                        <p className="text-slate-500 truncate">自備物：{b.self_provided_items?.details || '無'}</p>
                      </div>
                      <button
                        onClick={() => setAssigningBooking(b)}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 rounded-lg text-xs transition"
                      >
                        現場點交拍照並派房
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 修改 3：20 個籠位矩陣看板 (卡片上直接顯示 飼主姓名、電話與寵物名字) */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <span>🏠</span> 20 籠位即時狀態
                </h2>
                <button onClick={fetchRooms} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> 重新整理
                </button>
              </div>

              {loading ? (
                <p className="text-center text-slate-400 py-12">籠位載入中...</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {rooms.map((room) => {
                    const isOccupied = room.status === 'OCCUPIED';
                    // 比對出當前入住該籠位的預約單
                    const roomBooking = bookings.find(b => b.id === room.current_booking_id);

                    return (
                      <div
                        key={room.id}
                        onClick={() => handleRoomClick(room)}
                        className={`cursor-pointer rounded-2xl p-3.5 border-2 transition-all hover:shadow-md flex flex-col justify-between min-h-[120px] ${
                          isOccupied
                            ? 'bg-rose-50/80 border-rose-200 hover:border-rose-400'
                            : 'bg-white border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="font-black text-slate-700 text-sm">
                              籠位 {String(room.id).padStart(2, '0')}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isOccupied ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                              {isOccupied ? '入住中' : '空房'}
                            </span>
                          </div>

                          {/* 顯示住客詳細資訊 */}
                          {isOccupied && roomBooking ? (
                            <div className="space-y-0.5 text-xs">
                              <p className="font-extrabold text-slate-800 truncate">🐾 {roomBooking.pet_name}</p>
                              <p className="text-slate-600 font-medium truncate">👤 {roomBooking.owner_name}</p>
                              <p className="text-slate-400 text-[11px] truncate">📞 {roomBooking.owner_phone}</p>
                            </div>
                          ) : isOccupied ? (
                            <p className="text-xs font-bold text-slate-700">🐾 點擊查看詳情</p>
                          ) : (
                            <p className="text-[11px] text-slate-400 mt-2">點擊辦理現場入住</p>
                          )}
                        </div>

                        {isOccupied && (
                          <span className="text-[10px] text-rose-500 font-bold self-end mt-2">查看/退房 →</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------- 視圖 2：預約行事曆 (Calendar View) ----------------- */}
        {viewMode === 'calendar' && isAdminUnlocked && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-amber-500" /> 預約與佔用籠位行事曆
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1))}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold"
                >
                  ← 上個月
                </button>
                <span className="font-extrabold text-slate-800 px-2">
                  {currentCalendarDate.getFullYear()} 年 {currentCalendarDate.getMonth() + 1} 月
                </span>
                <button
                  onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1))}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold"
                >
                  下個月 →
                </button>
              </div>
            </div>

            {/* 日曆星期頭 */}
            <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 py-1">
              <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
            </div>

            {/* 日曆日期矩陣 */}
            <div className="grid grid-cols-7 gap-1.5">
              {generateCalendarDays().map((d, idx) => {
                if (!d) return <div key={idx} className="h-20 bg-slate-50/50 rounded-xl" />;

                // 修改 2：計算當日佔用的籠位數量
                const { totalRoomsOccupied, activeBookings } = getOccupiedRoomsForDate(d.dateStr);

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDateBookings({ dateStr: d.dateStr, list: activeBookings })}
                    className={`h-20 p-1.5 rounded-xl border flex flex-col justify-between cursor-pointer transition hover:border-amber-400 ${
                      totalRoomsOccupied > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-100'
                    }`}
                  >
                    <span className="font-bold text-xs text-slate-700">{d.day}</span>

                    {/* 修改 2：直觀標示當日佔用籠位數 (上限 20 籠) */}
                    {totalRoomsOccupied > 0 ? (
                      <div className="space-y-0.5">
                        <div className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded text-center truncate shadow-sm">
                          🏠 佔用 {totalRoomsOccupied} 籠
                        </div>
                        <p className="text-[9px] text-slate-500 text-center truncate">
                          ({activeBookings.length} 筆預約)
                        </p>
                      </div>
                    ) : (
                      <span className="text-[9px] text-slate-300 text-center">全空房</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ----------------- 視圖 3：顧客自主填單預約頁面 ----------------- */}
        {viewMode === 'customer' && (
          <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
            <div className="text-center space-y-2 border-b pb-4">
              <span className="text-4xl">🐰</span>
              <h2 className="text-2xl font-black text-slate-800">糰子兔 - 線上住宿預約單</h2>
              <p className="text-xs text-slate-500">請填寫照護需求與預約日期，現場點交時店員將為您核對並安排籠位！</p>
            </div>

            <form onSubmit={handleCustomerSubmit} className="space-y-4">
              {/* 寵物類別與隻數 (白話文選單) */}
              <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/60">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">寵物種類*</label>
                  <select
                    className="w-full border rounded-xl p-2 text-xs font-bold bg-white"
                    value={formData.pet_type}
                    onChange={e => setFormData({ ...formData, pet_type: e.target.value })}
                  >
                    <option value="兔子">🐰 兔子 ($350/天)</option>
                    <option value="龍貓">🐭 龍貓 ($350/天)</option>
                    <option value="天竺鼠">🐹 天竺鼠 ($300/天)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">入住隻數*</label>
                  <select
                    className="w-full border rounded-xl p-2 text-xs font-bold bg-white"
                    value={formData.pet_count}
                    onChange={e => {
                      const count = e.target.value;
                      setFormData({
                        ...formData,
                        pet_count: count,
                        stay_type: count === '1' ? '單獨住一籠' : '👨‍👩‍👧 擠同一籠（第二隻起每天+$100，不打折）'
                      });
                    }}
                  >
                    <option value="1">1 隻</option>
                    <option value="2">2 隻</option>
                    <option value="3">3 隻以上</option>
                  </select>
                </div>

                {formData.pet_count !== '1' && (
                  <div className="col-span-2 pt-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">入住安排方式*</label>
                    <select
                      className="w-full border rounded-xl p-2 text-xs font-bold bg-white"
                      value={formData.stay_type}
                      onChange={e => setFormData({ ...formData, stay_type: e.target.value })}
                    >
                      <option value="👨‍👩‍👧 擠同一籠（第二隻起每天+$100，不打折）">👨‍👩‍👧 擠同一籠 (第二隻起每天+$100，不打折)</option>
                      <option value="🚪 分開住不同籠（每隻各自算一籠的錢）">🚪 分開住不同籠 (每隻各自算一籠的錢)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* 飼主與寵物基本資料 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">飼主姓名*</label>
                  <input
                    required
                    type="text"
                    className="w-full border rounded-xl p-2 text-xs"
                    value={formData.owner_name}
                    onChange={e => setFormData({ ...formData, owner_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">飼主電話*</label>
                  <input
                    required
                    type="text"
                    className="w-full border rounded-xl p-2 text-xs"
                    value={formData.owner_phone}
                    onChange={e => setFormData({ ...formData, owner_phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">寵物名字*</label>
                  <input
                    required
                    type="text"
                    className="w-full border rounded-xl p-2 text-xs"
                    value={formData.pet_name}
                    onChange={e => setFormData({ ...formData, pet_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">寵物年齡</label>
                  <input
                    type="text"
                    placeholder="例如: 2歲 / 8個月"
                    className="w-full border rounded-xl p-2 text-xs"
                    value={formData.pet_age}
                    onChange={e => setFormData({ ...formData, pet_age: e.target.value })}
                  />
                </div>
              </div>

              {/* 入住/退房日期 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">預計入住日期*</label>
                  <input
                    required
                    type="date"
                    className="w-full border rounded-xl p-2 text-xs"
                    value={formData.check_in_date}
                    onChange={e => setFormData({ ...formData, check_in_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">預計退房日期*</label>
                  <input
                    required
                    type="date"
                    className="w-full border rounded-xl p-2 text-xs"
                    value={formData.check_out_date}
                    onChange={e => setFormData({ ...formData, check_out_date: e.target.value })}
                  />
                </div>
              </div>

              {/* 即時費用試算卡片 */}
              {estimate && estimate.days > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-emerald-800">預估住宿天數：{estimate.days} 天</span>
                    <span className="text-lg font-black text-emerald-700">${estimate.totalPrice} 元</span>
                  </div>
                  <p className="text-[11px] text-emerald-600 font-medium">💡 試算備註：{estimate.note}</p>
                </div>
              )}

              {/* 習慣與隨身物品 */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">飲水方式</label>
                  <select
                    className="w-full border rounded-xl p-2 bg-white"
                    value={formData.water_tool}
                    onChange={e => setFormData({ ...formData, water_tool: e.target.value })}
                  >
                    <option value="水碗">水碗</option>
                    <option value="滾珠水瓶">滾珠水瓶</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">餵食頻率</label>
                  <select
                    className="w-full border rounded-xl p-2 bg-white"
                    value={formData.feed_frequency}
                    onChange={e => setFormData({ ...formData, feed_frequency: e.target.value })}
                  >
                    <option value="一天兩次">一天兩次</option>
                    <option value="一天一次">一天一次</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">主食草</label>
                  <select
                    className="w-full border rounded-xl p-2 bg-white"
                    value={formData.hay_type}
                    onChange={e => setFormData({ ...formData, hay_type: e.target.value })}
                  >
                    <option value="提摩西">提摩西</option>
                    <option value="苜蓿草">苜蓿草</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">自備物品與注意事項備註</label>
                <textarea
                  rows="3"
                  placeholder="請列出攜帶的飼料品牌、草量、保健品或特殊照護習慣..."
                  className="w-full border rounded-xl p-2.5 text-xs"
                  value={formData.self_provided_items}
                  onChange={e => setFormData({ ...formData, self_provided_items: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-2xl shadow-lg transition text-sm"
              >
                送出線上預約單
              </button>
            </form>
          </div>
        )}

        {/* ----------------- 彈窗：店員為暫存預約【現場點交拍照 + 防呆派房】 ----------------- */}
        {assigningBooking && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-800">為【{assigningBooking.pet_name}】現場拍照與分配籠位</h3>
                <button onClick={() => setAssigningBooking(null)} className="text-slate-400 font-bold">✕</button>
              </div>

              {/* 現場拍照功能 */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700">拍照存檔隨身物品 (自動壓縮上傳)</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="text-xs text-slate-500"
                />
                {uploading && <p className="text-xs text-amber-600 font-bold">壓縮上傳中...</p>}
                <div className="flex gap-2 flex-wrap mt-2">
                  {formData.photo_urls.map((url, idx) => (
                    <img key={idx} src={url} alt="物品" className="w-16 h-16 object-cover rounded-xl border" />
                  ))}
                </div>
              </div>

              {/* 指派空籠區塊 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">選擇要放入的空籠：</label>
                <div className="grid grid-cols-4 gap-2">
                  {rooms.map(r => {
                    const isVacant = r.status === 'VACANT';
                    return (
                      <button
                        key={r.id}
                        disabled={!isVacant}
                        onClick={() => handleAssignRoom(assigningBooking.id, r.id)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                          isVacant
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                        }`}
                      >
                        籠位 {String(r.id).padStart(2, '0')}
                        {!isVacant && <span className="block text-[9px] font-normal text-rose-400">(滿)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- 彈窗：20籠位詳情 / 現場入住 ----------------- */}
        {selectedRoom && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-800">籠位 {String(selectedRoom.id).padStart(2, '0')} 號</h3>
                <button onClick={() => setSelectedRoom(null)} className="text-slate-400 font-bold">✕</button>
              </div>

              {selectedRoom.status === 'VACANT' && !showCheckInForm && (
                <div className="text-center py-6 space-y-3">
                  <p className="text-xs text-slate-500">此籠位目前空房中，是否要為現場散客辦理入住？</p>
                  <button
                    onClick={() => setShowCheckInForm(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition"
                  >
                    填寫現場入住單
                  </button>
                </div>
              )}

              {/* 入住中詳情 */}
              {selectedRoom.status === 'OCCUPIED' && currentBooking && (
                <div className="space-y-3 text-xs">
                  <div className="bg-rose-50/80 p-3.5 rounded-2xl border border-rose-100 space-y-1">
                    <p className="font-black text-slate-800 text-sm">🐾 {currentBooking.pet_name}</p>
                    <p className="text-slate-600">飼主：<span className="font-bold">{currentBooking.owner_name}</span> ({currentBooking.owner_phone})</p>
                    <p className="text-slate-500">住宿時間：{currentBooking.check_in_date} ~ {currentBooking.check_out_date}</p>
                    {currentBooking.self_provided_items?.pricing && (
                      <p className="text-emerald-700 font-bold mt-1">💰 {currentBooking.self_provided_items.pricing}</p>
                    )}
                  </div>

                  {currentBooking.photo_urls?.length > 0 && (
                    <div>
                      <p className="font-bold text-slate-700 mb-1">入店物品存檔相片：</p>
                      <div className="flex gap-2 flex-wrap">
                        {currentBooking.photo_urls.map((url, idx) => (
                          <img key={idx} src={url} alt="物品" className="w-20 h-20 object-cover rounded-xl border" />
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleCheckOut}
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 rounded-xl transition mt-4"
                  >
                    辦理退房點收 (自動清理照片)
                  </button>
                </div>
              )}

              {/* 現場入住表單 */}
              {selectedRoom.status === 'VACANT' && showCheckInForm && (
                <form onSubmit={handleCheckInSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      required
                      placeholder="飼主姓名*"
                      className="border rounded-xl p-2 text-xs"
                      value={formData.owner_name}
                      onChange={e => setFormData({ ...formData, owner_name: e.target.value })}
                    />
                    <input
                      required
                      placeholder="飼主電話*"
                      className="border rounded-xl p-2 text-xs"
                      value={formData.owner_phone}
                      onChange={e => setFormData({ ...formData, owner_phone: e.target.value })}
                    />
                    <input
                      required
                      placeholder="寵物姓名*"
                      className="border rounded-xl p-2 text-xs"
                      value={formData.pet_name}
                      onChange={e => setFormData({ ...formData, pet_name: e.target.value })}
                    />
                    <input
                      placeholder="寵物年齡"
                      className="border rounded-xl p-2 text-xs"
                      value={formData.pet_age}
                      onChange={e => setFormData({ ...formData, pet_age: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      required
                      type="date"
                      className="border rounded-xl p-2 text-xs"
                      value={formData.check_in_date}
                      onChange={e => setFormData({ ...formData, check_in_date: e.target.value })}
                    />
                    <input
                      required
                      type="date"
                      className="border rounded-xl p-2 text-xs"
                      value={formData.check_out_date}
                      onChange={e => setFormData({ ...formData, check_out_date: e.target.value })}
                    />
                  </div>

                  {/* 現場拍攝自備物品照片 */}
                  <div className="bg-slate-50 p-3 rounded-xl border space-y-1">
                    <label className="block text-xs font-bold text-slate-700">現場拍照存檔隨身物</label>
                    <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="text-xs" />
                    <div className="flex gap-1 flex-wrap mt-1">
                      {formData.photo_urls.map((url, idx) => (
                        <img key={idx} src={url} alt="物品" className="w-12 h-12 object-cover rounded-lg" />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs transition"
                  >
                    確認辦理入住並儲存
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ----------------- 行事曆點擊當日明細彈窗 (含修改/刪除) ----------------- */}
        {selectedDateBookings && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-800">🗓️ {selectedDateBookings.dateStr} 預約明細</h3>
                <button onClick={() => setSelectedDateBookings(null)} className="text-slate-400 font-bold">✕</button>
              </div>

              {selectedDateBookings.list.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">當日無預約紀錄。</p>
              ) : (
                <div className="space-y-3">
                  {selectedDateBookings.list.map(b => (
                    <div key={b.id} className="bg-slate-50 border rounded-2xl p-3.5 space-y-1.5 relative">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-800 text-xs">🐾 {b.pet_name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingBooking(b)}
                            className="p-1 text-slate-500 hover:text-amber-600 rounded"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteBooking(b.id)}
                            className="p-1 text-slate-500 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">飼主: {b.owner_name} ({b.owner_phone})</p>
                      <p className="text-xs text-slate-500">入住時間: {b.check_in_date} ~ {b.check_out_date}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------- 編輯預約單彈窗 ----------------- */}
        {editingBooking && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-800">✏️ 修改預約單資料</h3>
                <button onClick={() => setEditingBooking(null)} className="text-slate-400 font-bold">✕</button>
              </div>

              <form onSubmit={handleUpdateBookingSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold mb-1">飼主姓名</label>
                  <input
                    type="text"
                    className="w-full border rounded-xl p-2"
                    value={editingBooking.owner_name}
                    onChange={e => setEditingBooking({ ...editingBooking, owner_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">飼主電話</label>
                  <input
                    type="text"
                    className="w-full border rounded-xl p-2"
                    value={editingBooking.owner_phone}
                    onChange={e => setEditingBooking({ ...editingBooking, owner_phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">寵物名稱/資訊</label>
                  <input
                    type="text"
                    className="w-full border rounded-xl p-2"
                    value={editingBooking.pet_name}
                    onChange={e => setEditingBooking({ ...editingBooking, pet_name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold mb-1">入住日期</label>
                    <input
                      type="date"
                      className="w-full border rounded-xl p-2"
                      value={editingBooking.check_in_date}
                      onChange={e => setEditingBooking({ ...editingBooking, check_in_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">退房日期</label>
                    <input
                      type="date"
                      className="w-full border rounded-xl p-2"
                      value={editingBooking.check_out_date}
                      onChange={e => setEditingBooking({ ...editingBooking, check_out_date: e.target.value })}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition mt-2"
                >
                  儲存修改
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
