import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { RefreshCw, Plus, User, Package, Camera, Inbox, LayoutGrid, Lock, Edit3, Trash2, CalendarDays, ChevronLeft, ChevronRight, Utensils, Droplets, BookUser, Search, History } from 'lucide-react';
import imageCompression from 'browser-image-compression';

const ADMIN_PASSWORD = "8888";

// 輔助函式：將 ISO 字串 (2026-09-11T00:00:00+00:00) 轉為乾淨的 YYYY-MM-DD
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return String(dateStr).split('T')[0];
};

export default function App() {
  const [viewMode, setViewMode] = useState('customer'); // 'customer' | 'admin' | 'calendar' | 'customers_directory'
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [rooms, setRooms] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [currentBooking, setCurrentBooking] = useState(null);
  
  // 行事曆狀態
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedDateDetail, setSelectedDateDetail] = useState(null);

  // 常客通訊錄狀態
  const [searchCustomerQuery, setSearchCustomerQuery] = useState('');
  const [selectedCustomerHistory, setSelectedCustomerHistory] = useState(null);

  // 暫存區派房 & 修改預約
  const [assigningBooking, setAssigningBooking] = useState(null);
  const [assignTargetRooms, setAssignTargetRooms] = useState([]);
  const [editingBooking, setEditingBooking] = useState(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const initialFormState = {
    owner_name: '',
    owner_phone: '',
    pet_name: '',
    pet_type: '兔子',
    pet_count: 1,
    stay_type: '單獨住一籠',
    pet_age: '',
    pet_gender: '公',
    is_neutered: '已絕育',
    check_in_date: '',
    check_out_date: '',
    water_tool: '水碗',
    feed_frequency: '一天兩次',
    hay_type: '提摩西',
    mi_home_id: '不需要',
    self_provided_items: '',
    notes: '',
    photo_urls: []
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchRooms();
    fetchPendingBookings();
    fetchAllBookings();
  }, []);

  const fetchRooms = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('rooms').select('*').order('id', { ascending: true });
    if (!error) setRooms(data || []);
    setLoading(false);
  };

  const fetchPendingBookings = async () => {
    const { data, error } = await supabase.from('bookings').select('*').eq('status', 'PENDING').order('created_at', { ascending: false });
    if (!error) setPendingBookings(data || []);
  };

  const fetchAllBookings = async () => {
    const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
    if (!error) setAllBookings(data || []);
  };

  // 密碼解鎖驗證
  const handleUnlockAdmin = (e) => {
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

  // 圖片壓縮並上傳
  const handleFileUpload = async (event) => {
    try {
      setUploading(true);
      const imageFile = event.target.files[0];
      if (!imageFile) return;

      const options = { maxSizeMB: 0.3, maxWidthOrHeight: 1200, useWebWorker: true };
      const compressedFile = await imageCompression(imageFile, options);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

      const { error: uploadError } = await supabase.storage.from('pet-items').upload(fileName, compressedFile);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('pet-items').getPublicUrl(fileName);
      setFormData(prev => ({ ...prev, photo_urls: [...prev.photo_urls, data.publicUrl] }));
      alert('照片已成功壓縮並上傳！');
    } catch (error) {
      alert('圖片上傳失敗：' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 顧客提交線上預約
  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    try {
      const formattedPetName = `${formData.pet_name} (${formData.pet_type} / ${formData.pet_count}隻 / ${formData.stay_type})`;
      const { error } = await supabase.from('bookings').insert([{
        status: 'PENDING',
        room_id: null,
        owner_name: formData.owner_name,
        owner_phone: formData.owner_phone,
        pet_name: formattedPetName,
        pet_age: formData.pet_age,
        pet_gender: `${formData.pet_gender} (${formData.is_neutered})`,
        check_in_date: formatDate(formData.check_in_date),
        check_out_date: formatDate(formData.check_out_date),
        water_tool: formData.water_tool,
        feed_frequency: formData.feed_frequency,
        hay_type: formData.hay_type,
        mi_home_id: formData.mi_home_id || '不需要',
        self_provided_items: { details: formData.self_provided_items, notes: formData.notes },
        photo_urls: []
      }]);

      if (error) throw error;
      alert('🎉 預約單已成功送出！請於入住當天至現場由店員為您拍照點收與指派房間。');
      setFormData(initialFormState);
      fetchPendingBookings();
      fetchAllBookings();
    } catch (err) {
      alert('預約失敗：' + err.message);
    }
  };

  // 店員指派房間
  const handleConfirmAssign = async () => {
    if (formData.photo_urls.length === 0) {
      alert('⚠️ 現場規定：店員必須拍攝自備物品/寵物照片後方可完成入住！');
      return;
    }
    if (assignTargetRooms.length === 0) {
      alert('請至少選擇一個空籠位！');
      return;
    }

    try {
      const primaryRoomId = assignTargetRooms[0];
      const { error: updateErr } = await supabase.from('bookings').update({
        status: 'CONFIRMED',
        room_id: primaryRoomId,
        photo_urls: formData.photo_urls,
        assigned_rooms: assignTargetRooms
      }).eq('id', assigningBooking.id);

      if (updateErr) throw updateErr;

      for (const rId of assignTargetRooms) {
        await supabase.from('rooms').update({
          status: 'OCCUPIED',
          current_booking_id: assigningBooking.id
        }).eq('id', rId);
      }

      alert(`已成功指派至籠位：${assignTargetRooms.map(r => `[${r}號]`).join(', ')}，完成入住！`);
      setAssigningBooking(null);
      setAssignTargetRooms([]);
      setFormData(initialFormState);
      fetchRooms();
      fetchPendingBookings();
      fetchAllBookings();
    } catch (err) {
      alert('指派失敗：' + err.message);
    }
  };

  // 暫存區直接刪除不來的預約
  const handleDeletePendingBooking = async (bookingId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('確定要取消並刪除這筆暫存預約單嗎？')) return;
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
      if (error) throw error;
      alert('預約單已成功刪除！');
      fetchPendingBookings();
      fetchAllBookings();
    } catch (err) {
      alert('刪除失敗：' + err.message);
    }
  };

  // 修改預約單儲存
  const handleSaveEditBooking = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('bookings').update({
        owner_name: editingBooking.owner_name,
        owner_phone: editingBooking.owner_phone,
        pet_name: editingBooking.pet_name,
        pet_age: editingBooking.pet_age,
        pet_gender: editingBooking.pet_gender,
        check_in_date: formatDate(editingBooking.check_in_date),
        check_out_date: formatDate(editingBooking.check_out_date),
        water_tool: editingBooking.water_tool,
        feed_frequency: editingBooking.feed_frequency,
        hay_type: editingBooking.hay_type,
        mi_home_id: editingBooking.mi_home_id,
        self_provided_items: editingBooking.self_provided_items
      }).eq('id', editingBooking.id);

      if (error) throw error;
      alert('預約單資料已成功更新！');
      setEditingBooking(null);
      fetchPendingBookings();
      fetchAllBookings();
      fetchRooms();
    } catch (err) {
      alert('更新失敗：' + err.message);
    }
  };

  // 刪除行事曆預約
  const handleDeleteBooking = async (bookingId) => {
    if (!window.confirm('確定要刪除這筆預約單嗎？此操作不可逆。')) return;
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
      if (error) throw error;
      alert('預約已刪除！');
      if (selectedDateDetail) {
        setSelectedDateDetail(prev => ({
          ...prev,
          bookings: prev.bookings.filter(b => b.id !== bookingId)
        }));
      }
      fetchAllBookings();
      fetchPendingBookings();
      fetchRooms();
    } catch (err) {
      alert('刪除失敗：' + err.message);
    }
  };

  // 點擊籠位詳情
  const handleRoomClick = async (room) => {
    setSelectedRoom(room);
    setCurrentBooking(null);

    if (room.status === 'OCCUPIED' && room.current_booking_id) {
      const { data, error } = await supabase.from('bookings').select('*').eq('id', room.current_booking_id).single();
      if (!error) setCurrentBooking(data);
    }
  };

  // 辦理退房
  const handleCheckOut = async () => {
    if (!window.confirm(`確定要為籠位 ${selectedRoom.id} 辦理退房點收嗎？(系統將自動刪除照片檔案)`)) return;

    try {
      if (currentBooking?.photo_urls?.length > 0) {
        const filesToDelete = currentBooking.photo_urls.map(url => url.split('/').pop());
        await supabase.storage.from('pet-items').remove(filesToDelete);
      }

      const relatedRooms = currentBooking?.assigned_rooms || [selectedRoom.id];
      for (const rId of relatedRooms) {
        await supabase.from('rooms').update({ status: 'VACANT', current_booking_id: null }).eq('id', rId);
      }

      alert('退房與點收流程已完成！');
      setSelectedRoom(null);
      fetchRooms();
      fetchAllBookings();
    } catch (err) {
      alert('退房失敗：' + err.message);
    }
  };

  // 彙整客戶資料庫 (以電話為唯一識別)
  const customersList = useMemo(() => {
    const customerMap = {};

    allBookings.forEach((b) => {
      const key = b.owner_phone ? b.owner_phone.trim() : b.owner_name;
      if (!key) return;

      if (!customerMap[key]) {
        customerMap[key] = {
          owner_name: b.owner_name,
          owner_phone: b.owner_phone,
          pet_name: b.pet_name,
          pet_age: b.pet_age || '未填寫',
          mi_home_id: b.mi_home_id || '不需要',
          first_stay_date: formatDate(b.check_in_date),
          bookings: [b]
        };
      } else {
        customerMap[key].bookings.push(b);
        // 若該筆預約更早，更新為最早入住日期
        const currentIn = formatDate(b.check_in_date);
        if (currentIn && (!customerMap[key].first_stay_date || currentIn < customerMap[key].first_stay_date)) {
          customerMap[key].first_stay_date = currentIn;
        }
        // 更新最新資料
        if (b.mi_home_id && b.mi_home_id !== '不需要') customerMap[key].mi_home_id = b.mi_home_id;
        if (b.pet_age) customerMap[key].pet_age = b.pet_age;
      }
    });

    return Object.values(customerMap);
  }, [allBookings]);

  // 常客搜尋過濾
  const filteredCustomers = customersList.filter(c => 
    c.owner_name?.toLowerCase().includes(searchCustomerQuery.toLowerCase()) ||
    c.owner_phone?.includes(searchCustomerQuery) ||
    c.pet_name?.toLowerCase().includes(searchCustomerQuery.toLowerCase())
  );

  // 行事曆輔助計算
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const renderCalendarDays = () => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const totalDays = getDaysInMonth(year, month);
    const startOffset = getFirstDayOfMonth(year, month);

    const cells = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push(<div key={`empty-${i}`} className="bg-slate-50/50 border border-slate-100 min-h-[90px] rounded-xl"></div>);
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const dayBookings = allBookings.filter(b => {
        const inDate = formatDate(b.check_in_date);
        const outDate = formatDate(b.check_out_date);
        if (!inDate || !outDate) return false;
        return dateStr >= inDate && dateStr <= outDate;
      });

      let occupiedCages = 0;
      dayBookings.forEach(b => {
        if (b.assigned_rooms && b.assigned_rooms.length > 0) {
          occupiedCages += b.assigned_rooms.length;
        } else {
          occupiedCages += 1;
        }
      });

      cells.push(
        <div
          key={day}
          onClick={() => setSelectedDateDetail({ date: dateStr, bookings: dayBookings, occupiedCages })}
          className="bg-white border border-amber-100 hover:border-amber-400 p-2 min-h-[90px] rounded-xl flex flex-col justify-between cursor-pointer transition shadow-xs hover:shadow-sm"
        >
          <div className="flex justify-between items-center">
            <span className="font-bold text-xs text-slate-700">{day}</span>
            {occupiedCages > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-full">
                {occupiedCages} 籠
              </span>
            )}
          </div>

          <div className="space-y-1 mt-1 overflow-hidden">
            {dayBookings.slice(0, 2).map((b, idx) => (
              <div key={idx} className="text-[10px] truncate bg-emerald-50 text-emerald-800 px-1 py-0.5 rounded border border-emerald-100">
                🐾 {b.pet_name.split(' ')[0]}
              </div>
            ))}
            {dayBookings.length > 2 && (
              <div className="text-[9px] text-slate-400 text-center font-medium">
                +{dayBookings.length - 2} 筆
              </div>
            )}
          </div>
        </div>
      );
    }

    return cells;
  };

  return (
    <div className="min-h-screen bg-amber-50/40 p-4 md:p-8 font-sans text-slate-800">
      {/* 頂部導航 */}
      <header className="max-w-7xl mx-auto mb-6 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-amber-100">
        <h1 className="text-xl font-bold flex items-center gap-2">🐰 糰子兔 - 住宿管理系統</h1>
        <div className="flex items-center gap-2">
          {!isAdminUnlocked ? (
            <button onClick={() => setShowPasswordModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer">
              <Lock size={14} /> 店員專用通道
            </button>
          ) : (
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button onClick={() => setViewMode('admin')} className={`px-3 py-1.5 rounded-lg cursor-pointer ${viewMode === 'admin' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                <LayoutGrid size={14} className="inline mr-1"/> 籠位看板
              </button>
              <button onClick={() => setViewMode('calendar')} className={`px-3 py-1.5 rounded-lg cursor-pointer ${viewMode === 'calendar' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                🗓️ 預約行事曆
              </button>
              <button onClick={() => setViewMode('customers_directory')} className={`px-3 py-1.5 rounded-lg cursor-pointer ${viewMode === 'customers_directory' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                <BookUser size={14} className="inline mr-1"/> 📒 常客檔案
              </button>
              <button onClick={() => setViewMode('customer')} className={`px-3 py-1.5 rounded-lg cursor-pointer ${viewMode === 'customer' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}`}>
                📝 顧客預約單
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 密碼彈窗 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <form onSubmit={handleUnlockAdmin} className="bg-white p-6 rounded-2xl max-w-xs w-full space-y-4 shadow-xl">
            <h3 className="font-bold text-center">請輸入店員通行密碼</h3>
            <input 
              type="password" 
              required 
              placeholder="請輸入密碼" 
              className="w-full border rounded-xl p-2.5 text-center text-lg focus:outline-emerald-500" 
              value={passwordInput} 
              onChange={e => setPasswordInput(e.target.value)} 
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowPasswordModal(false)} className="w-1/2 py-2 text-xs text-slate-500 cursor-pointer">取消</button>
              <button type="submit" className="w-1/2 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer">驗證解鎖</button>
            </div>
          </form>
        </div>
      )}

      {/* 視圖 1: 顧客填單頁面 */}
      {viewMode === 'customer' && (
        <main className="max-w-xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-emerald-800">🐰 糰子兔 - 線上住宿預約單</h2>
            <p className="text-xs text-slate-500 mt-1">請填寫基本照護資料，現場將由店員為您拍照點收物品與排房！</p>
          </div>

          <form onSubmit={handleCustomerSubmit} className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">飼主姓名*</label>
                <input required type="text" className="w-full border rounded-lg p-2" value={formData.owner_name} onChange={e => setFormData({...formData, owner_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">飼主電話*</label>
                <input required type="tel" className="w-full border rounded-lg p-2" value={formData.owner_phone} onChange={e => setFormData({...formData, owner_phone: e.target.value})} />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">寵物姓名*</label>
                <input required type="text" className="w-full border rounded-lg p-2" value={formData.pet_name} onChange={e => setFormData({...formData, pet_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">寵物年齡</label>
                <input type="text" placeholder="例如：2歲" className="w-full border rounded-lg p-2" value={formData.pet_age} onChange={e => setFormData({...formData, pet_age: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">種類</label>
                <select className="w-full border rounded-lg p-2" value={formData.pet_type} onChange={e => setFormData({...formData, pet_type: e.target.value})}>
                  <option value="兔子">兔子</option>
                  <option value="天竺鼠">天竺鼠</option>
                  <option value="龍貓">龍貓</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">隻數</label>
                <input type="number" min="1" max="10" className="w-full border rounded-lg p-2" value={formData.pet_count} onChange={e => setFormData({...formData, pet_count: parseInt(e.target.value) || 1})} />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">入住方式</label>
                <select className="w-full border rounded-lg p-2" value={formData.stay_type} onChange={e => setFormData({...formData, stay_type: e.target.value})}>
                  <option value="單獨住一籠">單獨住一籠</option>
                  <option value="擠同一籠">擠同一籠</option>
                  <option value="分開住不同籠">分開住不同籠</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">性別</label>
                <select className="w-full border rounded-lg p-2" value={formData.pet_gender} onChange={e => setFormData({...formData, pet_gender: e.target.value})}>
                  <option value="公">公</option>
                  <option value="母">母</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">絕育狀態</label>
                <select className="w-full border rounded-lg p-2" value={formData.is_neutered} onChange={e => setFormData({...formData, is_neutered: e.target.value})}>
                  <option value="已絕育">已絕育</option>
                  <option value="未絕育">未絕育</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">飲水習慣</label>
                <select className="w-full border rounded-lg p-2" value={formData.water_tool} onChange={e => setFormData({...formData, water_tool: e.target.value})}>
                  <option value="水碗">水碗</option>
                  <option value="滾珠水瓶">滾珠水瓶</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">餵食頻率</label>
                <select className="w-full border rounded-lg p-2" value={formData.feed_frequency} onChange={e => setFormData({...formData, feed_frequency: e.target.value})}>
                  <option value="一天一次">一天一次</option>
                  <option value="一天兩次">一天兩次</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">主要牧草</label>
                <select className="w-full border rounded-lg p-2" value={formData.hay_type} onChange={e => setFormData({...formData, hay_type: e.target.value})}>
                  <option value="提摩西">提摩西</option>
                  <option value="苜蓿草">苜蓿草</option>
                  <option value="果樹草/其他">果樹草/其他</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">入住日期*</label>
                <input required type="date" className="w-full border rounded-lg p-2" value={formData.check_in_date} onChange={e => setFormData({...formData, check_in_date: e.target.value})} />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">預計退房日期*</label>
                <input required type="date" className="w-full border rounded-lg p-2" value={formData.check_out_date} onChange={e => setFormData({...formData, check_out_date: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                米家 ID* <span className="text-xs font-normal text-slate-400">(必填，無自備攝影機請直接填「不需要」)</span>
              </label>
              <input required type="text" className="w-full border rounded-lg p-2 bg-amber-50/20" value={formData.mi_home_id} onChange={e => setFormData({...formData, mi_home_id: e.target.value})} />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">自備物品清單與特殊照護備註</label>
              <textarea rows="3" placeholder="請填寫帶來的飼料份量、草架、專屬藥品或特殊習性..." className="w-full border rounded-lg p-2 bg-slate-50" value={formData.self_provided_items} onChange={e => setFormData({...formData, self_provided_items: e.target.value})} />
            </div>

            <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition cursor-pointer">
              送出預約單
            </button>
          </form>
        </main>
      )}

      {/* 視圖 2: 店員管理看板 */}
      {viewMode === 'admin' && (
        <main className="max-w-7xl mx-auto space-y-6">
          {/* 待派房暫存區 */}
          <section className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Inbox size={20} className="text-amber-600" /> 📥 待派房預約暫存區 ({pendingBookings.length})
              </h2>
              <button onClick={fetchPendingBookings} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer">
                <RefreshCw size={12} /> 刷新
              </button>
            </div>

            {pendingBookings.length === 0 ? (
              <p className="text-slate-400 text-xs py-2">目前沒有等待派房的線上預約單。</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingBookings.map((b) => (
                  <div key={b.id} className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 text-xs space-y-2 relative">
                    <div className="flex justify-between items-center font-bold text-slate-800">
                      <span className="truncate">🐾 {b.pet_name}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditingBooking(b)} className="text-slate-500 hover:text-slate-800 flex items-center gap-0.5 bg-white px-2 py-0.5 rounded border cursor-pointer">
                          <Edit3 size={11} /> 編輯
                        </button>
                        <button onClick={(e) => handleDeletePendingBooking(b.id, e)} className="text-rose-500 hover:bg-rose-50 flex items-center gap-0.5 bg-white px-2 py-0.5 rounded border border-rose-200 cursor-pointer" title="取消並刪除預約">
                          <Trash2 size={11} /> 刪除
                        </button>
                      </div>
                    </div>
                    <div className="text-slate-600">飼主：{b.owner_name} ({b.owner_phone})</div>
                    <div className="text-slate-500 font-medium">日期：{formatDate(b.check_in_date)} ~ {formatDate(b.check_out_date)}</div>
                    <div className="text-indigo-600 font-medium">米家 ID: {b.mi_home_id || '不需要'}</div>
                    <div className="text-slate-600 bg-white p-2 rounded border truncate">
                      備註物品：{b.self_provided_items?.details || '無'}
                    </div>
                    <button
                      onClick={() => {
                        setAssigningBooking(b);
                        setAssignTargetRooms([]);
                        setFormData(prev => ({ ...prev, photo_urls: [] }));
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-lg transition mt-2 cursor-pointer"
                    >
                      現場點交拍照並派房
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 20 個籠位看板 */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">🏠 20 籠位即時狀態</h2>
              <button onClick={fetchRooms} className="text-xs bg-white px-3 py-1.5 rounded-lg border text-slate-600 flex items-center gap-1 cursor-pointer">
                <RefreshCw size={14} /> 重新整理
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {rooms.map((room) => {
                const isOccupied = room.status === 'OCCUPIED';
                const relatedBooking = allBookings.find(b => b.id === room.current_booking_id);

                return (
                  <div
                    key={room.id}
                    onClick={() => handleRoomClick(room)}
                    className={`cursor-pointer rounded-2xl p-3.5 border-2 transition-all hover:shadow-md flex flex-col justify-between ${
                      isOccupied ? 'bg-rose-50/70 border-rose-200' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm text-slate-700">籠位 {String(room.id).padStart(2, '0')}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isOccupied ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          {isOccupied ? '入住中' : '空房'}
                        </span>
                      </div>

                      {isOccupied && relatedBooking ? (
                        <div className="text-[11px] space-y-1">
                          <div className="font-bold text-slate-800 truncate">🐾 {relatedBooking.pet_name.split(' ')[0]}</div>
                          <div className="text-slate-500 truncate">{relatedBooking.owner_name} ({relatedBooking.owner_phone})</div>
                          
                          <div className="text-[10px] text-amber-800 bg-amber-100/60 px-1.5 py-0.5 rounded truncate font-medium">
                            📅 {formatDate(relatedBooking.check_in_date)} ~ {formatDate(relatedBooking.check_out_date)}
                          </div>

                          <div className="grid grid-cols-2 gap-1 pt-1 text-[10px]">
                            <div className="bg-white/80 p-1 rounded border border-rose-100 flex items-center gap-0.5 text-slate-700 truncate">
                              <Utensils size={10} className="text-amber-600 shrink-0"/> {relatedBooking.hay_type || '牧草'}
                            </div>
                            <div className="bg-white/80 p-1 rounded border border-rose-100 flex items-center gap-0.5 text-slate-700 truncate">
                              <Droplets size={10} className="text-blue-500 shrink-0"/> {relatedBooking.water_tool || '飲水'}
                            </div>
                          </div>
                          <div className="text-[9px] text-slate-500 bg-white/60 px-1 py-0.5 rounded text-center truncate">
                            餵食：{relatedBooking.feed_frequency || '未設定'}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 py-6 text-center flex items-center justify-center gap-1">
                          <Plus size={14} /> 空房可派
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      )}

      {/* 視圖 3: 預約行事曆 */}
      {viewMode === 'calendar' && (
        <main className="max-w-6xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center border-b pb-4">
            <h2 className="text-xl font-bold text-slate-800">
              🗓️ {currentCalendarDate.getFullYear()} 年 {currentCalendarDate.getMonth() + 1} 月 住宿排程
            </h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1))}
                className="p-2 border rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => setCurrentCalendarDate(new Date())}
                className="px-3 py-1.5 text-xs font-bold border rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                回到本月
              </button>
              <button 
                onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1))}
                className="p-2 border rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center font-bold text-xs text-slate-500 py-1">
            <div className="text-rose-500">日</div>
            <div>一</div>
            <div>二</div>
            <div>三</div>
            <div>四</div>
            <div>五</div>
            <div className="text-emerald-600">六</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {renderCalendarDays()}
          </div>
        </main>
      )}

      {/* 視圖 4: 📒 常客通訊錄（顧客歷史檔案） */}
      {viewMode === 'customers_directory' && (
        <main className="max-w-6xl mx-auto space-y-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BookUser size={20} className="text-amber-600" /> 📒 常客通訊錄 ({customersList.length} 位)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">系統自動彙整所有預約歷史，點擊可查閱各次住宿紀錄與習慣。</p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="搜尋飼主姓名、電話或寵物..." 
                className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:outline-emerald-500 bg-slate-50/50"
                value={searchCustomerQuery}
                onChange={e => setSearchCustomerQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map((customer, idx) => (
              <div 
                key={idx} 
                className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-amber-400 transition shadow-xs flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-base text-slate-800">{customer.owner_name}</span>
                      <span className="text-xs text-slate-400 ml-2">({customer.owner_phone})</span>
                    </div>
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                      住宿 {customer.bookings.length} 次
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1 text-slate-600 border border-slate-100">
                    <div>🐾 <b>寵物名稱：</b>{customer.pet_name}</div>
                    <div>🎂 <b>寵物歲數：</b>{customer.pet_age}</div>
                    <div>📅 <b>第一次住宿：</b>{customer.first_stay_date || '無紀錄'}</div>
                    <div>📷 <b>米家 ID：</b>{customer.mi_home_id}</div>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedCustomerHistory(customer)}
                  className="w-full py-2 bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <History size={14} /> 查看每次住宿詳情 ({customer.bookings.length})
                </button>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* 彈窗：常客歷史住宿明細 */}
      {selectedCustomerHistory && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{selectedCustomerHistory.owner_name} 的住宿歷史檔案</h3>
                <p className="text-xs text-slate-500">電話：{selectedCustomerHistory.owner_phone} | 累積次數：{selectedCustomerHistory.bookings.length} 次</p>
              </div>
              <button onClick={() => setSelectedCustomerHistory(null)} className="text-slate-400 font-bold text-lg cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              {selectedCustomerHistory.bookings.map((b, i) => (
                <div key={b.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between items-center font-bold text-slate-800">
                    <span>第 {selectedCustomerHistory.bookings.length - i} 次住宿 🐾 {b.pet_name}</span>
                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{b.status === 'CONFIRMED' ? '已入住' : '待派房'}</span>
                  </div>
                  <div className="text-slate-600">
                    📅 住宿日期：<b>{formatDate(b.check_in_date)} ~ {formatDate(b.check_out_date)}</b>
                  </div>
                  <div className="text-slate-500">
                    飲食習性：{b.hay_type || '提摩西'} / {b.feed_frequency || '未填'} / {b.water_tool || '水碗'}
                  </div>
                  {b.self_provided_items?.details && (
                    <div className="text-slate-600 bg-white p-2 rounded border truncate">
                      自備物備註：{b.self_provided_items.details}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 彈窗：點選特定日期查看住客名單 */}
      {selectedDateDetail && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{selectedDateDetail.date} 住客名單</h3>
                <span className="text-xs text-amber-700 font-semibold">當日佔用總籠數：{selectedDateDetail.occupiedCages} / 20 籠</span>
              </div>
              <button onClick={() => setSelectedDateDetail(null)} className="text-slate-400 font-bold text-lg cursor-pointer">✕</button>
            </div>

            {selectedDateDetail.bookings.length === 0 ? (
              <p className="text-slate-400 text-xs py-4 text-center">當日尚無任何寵物預約。</p>
            ) : (
              <div className="space-y-2.5">
                {selectedDateDetail.bookings.map((b) => (
                  <div key={b.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs space-y-1.5 relative">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-slate-800">🐾 {b.pet_name}</span>
                      <div className="flex gap-1">
                        <button onClick={() => setEditingBooking(b)} className="px-2 py-1 bg-white border rounded text-slate-600 hover:text-slate-900 cursor-pointer">
                          編輯
                        </button>
                        <button onClick={() => handleDeleteBooking(b.id)} className="px-2 py-1 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded cursor-pointer">
                          刪除
                        </button>
                      </div>
                    </div>
                    <div className="text-slate-600">飼主：{b.owner_name} ({b.owner_phone})</div>
                    <div className="text-slate-500">住宿區間：{formatDate(b.check_in_date)} ~ {formatDate(b.check_out_date)}</div>
                    <div className="text-amber-700">狀態：{b.status === 'CONFIRMED' ? `已入住 (籠位: ${b.assigned_rooms?.join(', ') || b.room_id || '未標註'})` : '待派房暫存'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 彈窗：店員現場指派籠位 */}
      {assigningBooking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-bold text-slate-800">為【{assigningBooking.pet_name}】拍照點收並派房</h3>
              <button onClick={() => setAssigningBooking(null)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl text-xs space-y-1">
              <div><b>飼主：</b>{assigningBooking.owner_name} ({assigningBooking.owner_phone})</div>
              <div><b>日期：</b>{formatDate(assigningBooking.check_in_date)} ~ {formatDate(assigningBooking.check_out_date)}</div>
              <div><b>米家 ID：</b>{assigningBooking.mi_home_id || '不需要'}</div>
              <div><b>自備物品：</b>{assigningBooking.self_provided_items?.details || '無'}</div>
            </div>

            {/* 拍照檢核區塊 */}
            <div className="border-t pt-3">
              <label className="block text-xs font-bold text-rose-600 mb-1 flex items-center gap-1">
                <Camera size={14} /> 現場拍照點收 (必拍項目)*
              </label>
              <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} disabled={uploading} className="w-full text-xs text-slate-500" />
              {uploading && <p className="text-xs text-amber-600 mt-1">壓縮上傳中...</p>}
              
              <div className="flex gap-2 mt-2 overflow-x-auto">
                {formData.photo_urls.map((url, i) => (
                  <img key={i} src={url} alt="物品照" className="w-16 h-16 object-cover rounded border" />
                ))}
              </div>
              {formData.photo_urls.length === 0 && (
                <p className="text-xs text-slate-400 mt-1">⚠️ 尚未拍攝照片，拍照後才可送出完成入住。</p>
              )}
            </div>

            {/* 空籠選擇 */}
            <div className="border-t pt-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                選擇空籠位 (若分籠可複選)：
              </label>
              <div className="grid grid-cols-4 gap-2">
                {rooms.filter(r => r.status === 'VACANT').map(r => {
                  const isSelected = assignTargetRooms.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setAssignTargetRooms(assignTargetRooms.filter(id => id !== r.id));
                        } else {
                          setAssignTargetRooms([...assignTargetRooms, r.id]);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        isSelected ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      籠位 {String(r.id).padStart(2, '0')}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleConfirmAssign}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition cursor-pointer"
            >
              確認拍照並完成入住
            </button>
          </div>
        </div>
      )}

      {/* 彈窗：修改預約單內容 */}
      {editingBooking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <form onSubmit={handleSaveEditBooking} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold">✏️ 修改預約單資料</h3>
              <button type="button" onClick={() => setEditingBooking(null)} className="text-slate-400 cursor-pointer">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">飼主姓名</label>
                <input required type="text" className="w-full border rounded p-2" value={editingBooking.owner_name} onChange={e => setEditingBooking({...editingBooking, owner_name: e.target.value})} />
              </div>
              <div>
                <label className="font-semibold block mb-1">飼主電話</label>
                <input required type="text" className="w-full border rounded p-2" value={editingBooking.owner_phone} onChange={e => setEditingBooking({...editingBooking, owner_phone: e.target.value})} />
              </div>
              <div>
                <label className="font-semibold block mb-1">寵物姓名/資訊</label>
                <input required type="text" className="w-full border rounded p-2" value={editingBooking.pet_name} onChange={e => setEditingBooking({...editingBooking, pet_name: e.target.value})} />
              </div>
              <div>
                <label className="font-semibold block mb-1">米家 ID</label>
                <input required type="text" className="w-full border rounded p-2" value={editingBooking.mi_home_id || ''} onChange={e => setEditingBooking({...editingBooking, mi_home_id: e.target.value})} />
              </div>
              <div>
                <label className="font-semibold block mb-1">入住日期</label>
                <input required type="date" className="w-full border rounded p-2" value={formatDate(editingBooking.check_in_date)} onChange={e => setEditingBooking({...editingBooking, check_in_date: e.target.value})} />
              </div>
              <div>
                <label className="font-semibold block mb-1">退房日期</label>
                <input required type="date" className="w-full border rounded p-2" value={formatDate(editingBooking.check_out_date)} onChange={e => setEditingBooking({...editingBooking, check_out_date: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="font-semibold block text-xs mb-1">自備物品清單與備註</label>
              <textarea
                rows="3"
                className="w-full border rounded p-2 text-xs"
                value={editingBooking.self_provided_items?.details || ''}
                onChange={e => setEditingBooking({
                  ...editingBooking,
                  self_provided_items: { ...editingBooking.self_provided_items, details: e.target.value }
                })}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditingBooking(null)} className="w-1/2 py-2 text-xs text-slate-500 border rounded-xl cursor-pointer">取消</button>
              <button type="submit" className="w-1/2 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl cursor-pointer">儲存修改</button>
            </div>
          </form>
        </div>
      )}

      {/* 彈窗：籠位詳情 */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h2 className="text-xl font-bold text-slate-800">籠位 {String(selectedRoom.id).padStart(2, '0')} 號</h2>
              <button onClick={() => setSelectedRoom(null)} className="text-slate-400 text-xl font-bold cursor-pointer">✕</button>
            </div>

            {selectedRoom.status === 'OCCUPIED' && currentBooking && (
              <div className="space-y-4 text-sm">
                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/60 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-slate-800">🐾 {currentBooking.pet_name}</span>
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-semibold">{currentBooking.pet_gender}</span>
                  </div>
                  <div className="text-slate-600 flex items-center gap-2">
                    <User size={14} /> 飼主：{currentBooking.owner_name} ({currentBooking.owner_phone})
                  </div>
                  <div className="text-slate-500 text-xs">
                    📅 住宿日期：{formatDate(currentBooking.check_in_date)} ~ {formatDate(currentBooking.check_out_date)}
                  </div>
                  <div className="text-xs text-indigo-600 font-medium">📷 米家 ID: {currentBooking.mi_home_id || '不需要'}</div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-100 p-2 rounded-lg"><span className="block text-slate-400">飲水</span><b className="text-slate-700 text-sm">{currentBooking.water_tool}</b></div>
                  <div className="bg-slate-100 p-2 rounded-lg"><span className="block text-slate-400">飼料</span><b className="text-slate-700 text-sm">{currentBooking.feed_frequency}</b></div>
                  <div className="bg-slate-100 p-2 rounded-lg"><span className="block text-slate-400">主食草</span><b className="text-slate-700 text-sm">{currentBooking.hay_type}</b></div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border space-y-1">
                  <div className="font-semibold text-slate-700 flex items-center gap-1 mb-1"><Package size={15}/> 物品清單與特殊備註：</div>
                  <div className="text-slate-600 whitespace-pre-wrap bg-white p-2.5 rounded border text-xs">{currentBooking.self_provided_items?.details || '未填寫'}</div>
                </div>

                {currentBooking.photo_urls && currentBooking.photo_urls.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-700 flex items-center gap-1 mb-2"><Camera size={15}/> 點收照片：</div>
                    <div className="grid grid-cols-3 gap-2">
                      {currentBooking.photo_urls.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt="點收照片" className="w-full h-20 object-cover rounded-lg border hover:opacity-80" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={handleCheckOut} className="w-full mt-4 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 rounded-xl transition cursor-pointer">
                  辦理退房點收 (清理照片並釋放房間)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
