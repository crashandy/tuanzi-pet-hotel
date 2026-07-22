import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { RefreshCw, Plus, User, Package, Camera, Inbox, LayoutGrid, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Lock, Unlock, Trash2, Edit3 } from 'lucide-react';
import imageCompression from 'browser-image-compression';

// 🔑 店員解鎖密碼設定
const ADMIN_PASSWORD = '9358';

export default function App() {
  // 預設強制為 'customer' (顧客預約單)
  const [viewMode, setViewMode] = useState('customer');
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

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    owner_name: '', owner_phone: '', pet_name: '', pet_age: '',
    pet_gender: '公', is_neutered: '已絕育', check_in_date: '', check_out_date: '',
    water_tool: '水碗', feed_frequency: '一天兩次', hay_type: '提摩西',
    mi_home_id: '', self_provided_items: '', photo_urls: []
  });

  useEffect(() => {
    fetchRooms();
    fetchPendingBookings();
    fetchAllBookings();
  }, []);

  const fetchRooms = async () => {
    setLoading(true);
    const { data } = await supabase.from('rooms').select('*').order('id', { ascending: true });
    if (data) setRooms(data);
    setLoading(false);
  };

  const fetchPendingBookings = async () => {
    const { data } = await supabase.from('bookings').select('*').eq('status', 'PENDING').order('created_at', { ascending: false });
    if (data) setPendingBookings(data);
  };

  const fetchAllBookings = async () => {
    const { data } = await supabase.from('bookings').select('*');
    if (data) setAllBookings(data);
  };

  const handleUnlockAdmin = (e) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdminUnlocked(true);
      setShowPasswordModal(false);
      setPasswordInput('');
      setViewMode('admin');
      alert('🔓 店員權限解鎖成功！');
    } else {
      alert('❌ 密碼錯誤！');
    }
  };

  const handleDeleteBooking = async (bookingId) => {
    if (!window.confirm('確定要取消並刪除這筆預約紀錄嗎？')) return;
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
      if (error) throw error;
      alert('預約已刪除！');
      if (selectedCalendarDate) {
        setSelectedCalendarDate(prev => ({
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
          check_out_date: editingBooking.check_out_date,
          water_tool: editingBooking.water_tool,
          feed_frequency: editingBooking.feed_frequency,
          hay_type: editingBooking.hay_type,
          mi_home_id: editingBooking.mi_home_id
        })
        .eq('id', editingBooking.id);

      if (error) throw error;
      alert('預約已修改！');
      setEditingBooking(null);
      setSelectedCalendarDate(null);
      fetchAllBookings();
      fetchPendingBookings();
    } catch (err) {
      alert('修改失敗：' + err.message);
    }
  };

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
      alert('照片已自動壓縮上傳！');
    } catch (error) {
      alert('圖片上傳失敗：' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('bookings').insert([
        {
          status: 'PENDING',
          room_id: null,
          owner_name: formData.owner_name,
          owner_phone: formData.owner_phone,
          pet_name: formData.pet_name,
          pet_age: formData.pet_age,
          pet_gender: `${formData.pet_gender} (${formData.is_neutered})`,
          check_in_date: formData.check_in_date,
          check_out_date: formData.check_out_date,
          water_tool: formData.water_tool,
          feed_frequency: formData.feed_frequency,
          hay_type: formData.hay_type,
          mi_home_id: formData.mi_home_id,
          self_provided_items: { details: formData.self_provided_items },
          photo_urls: []
        }
      ]);

      if (error) throw error;
      alert('🎉 預約單已送出！請於入住當天由店員協助辦理點收。');
      setFormData({
        owner_name: '', owner_phone: '', pet_name: '', pet_age: '',
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

  const handleCheckInSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert([
          {
            status: 'CONFIRMED',
            room_id: selectedRoom.id,
            owner_name: formData.owner_name,
            owner_phone: formData.owner_phone,
            pet_name: formData.pet_name,
            pet_age: formData.pet_age,
            pet_gender: `${formData.pet_gender} (${formData.is_neutered})`,
            check_in_date: formData.check_in_date,
            check_out_date: formData.check_out_date,
            water_tool: formData.water_tool,
            feed_frequency: formData.feed_frequency,
            hay_type: formData.hay_type,
            mi_home_id: formData.mi_home_id,
            self_provided_items: { details: formData.self_provided_items },
            photo_urls: formData.photo_urls
          }
        ]).select().single();

      if (bookingError) throw bookingError;

      await supabase.from('rooms').update({ status: 'OCCUPIED', current_booking_id: bookingData.id }).eq('id', selectedRoom.id);
      alert(`籠位 ${selectedRoom.id} 號入住成功！`);
      setShowCheckInForm(false);
      setSelectedRoom(null);
      fetchRooms();
      fetchAllBookings();
    } catch (err) {
      alert('入住失敗：' + err.message);
    }
  };

  const handleAssignRoom = async (bookingId, targetRoomId) => {
    try {
      await supabase.from('bookings').update({ status: 'CONFIRMED', room_id: targetRoomId, photo_urls: formData.photo_urls }).eq('id', bookingId);
      await supabase.from('rooms').update({ status: 'OCCUPIED', current_booking_id: bookingId }).eq('id', targetRoomId);

      alert(`成功指派至籠位 ${targetRoomId} 號！`);
      setAssigningBooking(null);
      fetchRooms();
      fetchPendingBookings();
      fetchAllBookings();
    } catch (err) {
      alert('指派失敗：' + err.message);
    }
  };

  const handleCheckOut = async () => {
    if (!window.confirm(`確定要為籠位 ${selectedRoom.id} 辦理退房點收？`)) return;
    try {
      if (currentBooking?.photo_urls?.length > 0) {
        const filesToDelete = currentBooking.photo_urls.map(url => url.split('/').pop());
        await supabase.storage.from('pet-items').remove(filesToDelete);
      }
      await supabase.from('rooms').update({ status: 'VACANT', current_booking_id: null }).eq('id', selectedRoom.id);
      alert(`籠位 ${selectedRoom.id} 已順利退房！`);
      setSelectedRoom(null);
      fetchRooms();
      fetchAllBookings();
    } catch (err) {
      alert('退房失敗：' + err.message);
    }
  };

  const handleRoomClick = async (room) => {
    setSelectedRoom(room);
    setShowCheckInForm(false);
    setCurrentBooking(null);
    if (room.status === 'OCCUPIED' && room.current_booking_id) {
      const { data: booking } = await supabase.from('bookings').select('*').eq('id', room.current_booking_id).single();
      if (booking) setCurrentBooking(booking);
    }
  };

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const currentYear = currentMonth.getFullYear();
  const currentMonthIdx = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonthIdx);
  const firstDayOfWeek = getFirstDayOfMonth(currentYear, currentMonthIdx);

  const getBookingsForDate = (dateString) => {
    return allBookings.filter(b => b.check_in_date === dateString || b.check_out_date === dateString || (b.check_in_date <= dateString && b.check_out_date >= dateString));
  };

  return (
    <div className="min-h-screen bg-amber-50/40 p-4 md:p-8 font-sans">
      <header className="max-w-7xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-amber-100 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">🐰 糰子兔 - 線上預約與管理系統</h1>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold items-center gap-1">
          <button
            onClick={() => setViewMode('customer')}
            className={`px-3 py-2 rounded-lg transition ${viewMode === 'customer' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            📝 顧客預約單
          </button>

          {isAdminUnlocked ? (
            <>
              <button
                onClick={() => setViewMode('admin')}
                className={`px-3 py-2 rounded-lg transition ${viewMode === 'admin' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <LayoutGrid size={14} className="inline mr-1" /> 看板
              </button>

              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-2 rounded-lg transition ${viewMode === 'calendar' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <CalendarIcon size={14} className="inline mr-1" /> 行事曆
              </button>

              <button onClick={() => { setIsAdminUnlocked(false); setViewMode('customer'); }} className="px-2 py-1.5 text-rose-500 hover:text-rose-700">
                <Unlock size={14} /> 上鎖
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-3 py-2 text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <Lock size={13} /> 店員專用通道
            </button>
          )}
        </div>
      </header>

      {/* 1. 顧客預約頁面 (預設顯示) */}
      {viewMode === 'customer' && (
        <main className="max-w-xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-emerald-800">🐰 糰子兔 - 線上住宿預約單</h2>
            <p className="text-xs text-slate-500 mt-1">請填寫預約與照護習慣，現場點交時店員將協助您完成入住！</p>
          </div>

          <form onSubmit={handleCustomerSubmit} className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">飼主姓名*</label>
                <input required type="text" className="w-full border rounded-lg p-2" value={formData.owner_name} onChange={e => setFormData({...formData, owner_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">飼主電話*</label>
                <input required type="text" className="w-full border rounded-lg p-2" value={formData.owner_phone} onChange={e => setFormData({...formData, owner_phone: e.target.value})} />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">寵物姓名*</label>
                <input required type="text" className="w-full border rounded-lg p-2" value={formData.pet_name} onChange={e => setFormData({...formData, pet_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">寵物年齡</label>
                <input type="text" placeholder="例如：1歲半" className="w-full border rounded-lg p-2" value={formData.pet_age} onChange={e => setFormData({...formData, pet_age: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">寵物性別</label>
                <select className="w-full border rounded-lg p-2" value={formData.pet_gender} onChange={e => setFormData({...formData, pet_gender: e.target.value})}>
                  <option value="公">公</option>
                  <option value="母">母</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">是否絕育</label>
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
                <label className="block text-slate-600 font-semibold mb-1">飼料頻率</label>
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
                <label className="block text-slate-600 font-semibold mb-1">預計入住日期*</label>
                <input required type="date" className="w-full border rounded-lg p-2" value={formData.check_in_date} onChange={e => setFormData({...formData, check_in_date: e.target.value})} />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">預計退房日期*</label>
                <input required type="date" className="w-full border rounded-lg p-2" value={formData.check_out_date} onChange={e => setFormData({...formData, check_out_date: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">米家 ID (選填)</label>
              <input type="text" placeholder="若有自備攝影機請提供" className="w-full border rounded-lg p-2" value={formData.mi_home_id} onChange={e => setFormData({...formData, mi_home_id: e.target.value})} />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">自備物品詳細清單 (自備飼料、用具、草架等)</label>
              <textarea rows="3" placeholder="請列出您預計攜帶的物品與份量" className="w-full border rounded-lg p-2 bg-slate-50" value={formData.self_provided_items} onChange={e => setFormData({...formData, self_provided_items: e.target.value})} />
            </div>

            <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition">
              送出預約單
            </button>
          </form>
        </main>
      )}

      {/* 2. 店員管理看板 (解鎖後可看) */}
      {viewMode === 'admin' && isAdminUnlocked && (
        <main className="max-w-7xl mx-auto space-y-8">
          <section className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Inbox size={20} className="text-amber-600" /> 📥 待派房預約暫存區 ({pendingBookings.length})
              </h2>
              <button onClick={fetchPendingBookings} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                <RefreshCw size={12} /> 刷新
              </button>
            </div>

            {pendingBookings.length === 0 ? (
              <p className="text-slate-400 text-xs py-2">目前沒有等待派房的線上預約單。</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingBookings.map((b) => (
                  <div key={b.id} className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 text-xs space-y-2">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>🐾 {b.pet_name} ({b.pet_gender})</span>
                      <span className="text-amber-700">飼主: {b.owner_name}</span>
                    </div>
                    <div className="text-slate-500">時間：{b.check_in_date} ~ {b.check_out_date}</div>
                    <div className="text-slate-600 bg-white p-2 rounded border truncate">自備物：{b.self_provided_items?.details || '無'}</div>

                    <button onClick={() => setAssigningBooking(b)} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 rounded-lg transition">
                      現場點交拍照並派房
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">🏠 20 籠位即時狀態</h2>
              <button onClick={fetchRooms} className="text-xs bg-white px-3 py-1.5 rounded-lg border text-slate-600 flex items-center gap-1">
                <RefreshCw size={14} /> 重新整理
              </button>
            </div>

            {loading ? (
              <div className="text-center py-10 text-slate-400">載入中...</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                {rooms.map((room) => {
                  const isOccupied = room.status === 'OCCUPIED';
                  return (
                    <div
                      key={room.id}
                      onClick={() => handleRoomClick(room)}
                      className={`cursor-pointer rounded-2xl p-4 border-2 transition-all hover:shadow-md ${isOccupied ? 'bg-rose-50/70 border-rose-200 hover:border-rose-400' : 'bg-white border-slate-200 hover:border-emerald-300'}`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-lg text-slate-700">籠位 {String(room.id).padStart(2, '0')}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isOccupied ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          {isOccupied ? '入住中' : '空房'}
                        </span>
                      </div>
                      {isOccupied ? <div className="text-xs text-rose-900 font-bold">🐾 查看住客資料</div> : <div className="text-xs text-slate-400 py-3 text-center flex items-center justify-center gap-1"><Plus size={14}/> 現場入住</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      )}

      {/* 3. 預約行事曆 (解鎖後可看) */}
      {viewMode === 'calendar' && isAdminUnlocked && (
        <main className="max-w-7xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              🗓️ {currentYear} 年 {currentMonthIdx + 1} 月 預約行事曆
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentMonth(new Date(currentYear, currentMonthIdx - 1, 1))} className="p-2 border rounded-lg hover:bg-slate-100"><ChevronLeft size={18} /></button>
              <button onClick={() => setCurrentMonth(new Date())} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-slate-100 font-medium">本月</button>
              <button onClick={() => setCurrentMonth(new Date(currentYear, currentMonthIdx + 1, 1))} className="p-2 border rounded-lg hover:bg-slate-100"><ChevronRight size={18} /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-500 mb-2">
            <div className="text-rose-500">日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div className="text-indigo-500">六</div>
          </div>

          <div className="grid grid-cols-7 gap-1 bg-slate-100 p-1 rounded-xl">
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="bg-white/50 h-24 rounded-lg"></div>
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateString = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayBookings = getBookingsForDate(dateString);

              return (
                <div
                  key={dayNum}
                  onClick={() => setSelectedCalendarDate({ date: dateString, bookings: dayBookings })}
                  className="bg-white h-24 p-1.5 rounded-lg border hover:border-amber-400 cursor-pointer transition flex flex-col justify-between"
                >
                  <div className="font-bold text-xs text-slate-700">{dayNum}</div>
                  {dayBookings.length > 0 ? (
                    <div className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded text-[10px] truncate">
                      🐾 {dayBookings.length} 隻預約
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-300">空房</div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      )}

      {/* 密碼彈窗 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xs w-full p-6 shadow-xl text-center space-y-4">
            <h3 className="font-bold text-slate-800 text-lg flex items-center justify-center gap-1">
              <Lock size={18} className="text-amber-600" /> 店員權限解鎖
            </h3>
            <form onSubmit={handleUnlockAdmin} className="space-y-3">
              <input
                type="password"
                placeholder="請輸入店員密碼"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                className="w-full border rounded-xl p-2.5 text-center text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="w-1/2 bg-slate-100 text-slate-600 py-2 rounded-xl text-xs font-bold">取消</button>
                <button type="submit" className="w-1/2 bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold">確認解鎖</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 行事曆預約明細與修改/刪除 */}
      {selectedCalendarDate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-bold text-slate-800">📅 {selectedCalendarDate.date} 預約明細</h3>
              <button onClick={() => setSelectedCalendarDate(null)} className="text-slate-400 font-bold">✕</button>
            </div>

            {selectedCalendarDate.bookings.length === 0 ? (
              <p className="text-slate-400 text-xs py-4 text-center">當天目前無預約。</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedCalendarDate.bookings.map((b) => (
                  <div key={b.id} className="bg-slate-50 p-3 rounded-xl border text-xs flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-800">🐾 {b.pet_name} (飼主: {b.owner_name})</div>
                      <div className="text-slate-500">入住: {b.check_in_date} ~ 退房: {b.check_out_date}</div>
                      <div className="text-indigo-600 font-semibold">{b.status === 'CONFIRMED' ? `籠位 ${String(b.room_id).padStart(2, '0')}` : '待派房暫存'}</div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => setEditingBooking(b)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100">
                        <Edit3 size={15} />
                      </button>
                      <button onClick={() => handleDeleteBooking(b.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 修改預約單彈窗 */}
      {editingBooking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-bold text-slate-800">修改【{editingBooking.pet_name}】預約單</h3>
              <button onClick={() => setEditingBooking(null)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleUpdateBooking} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-600">飼主姓名</label>
                  <input type="text" className="w-full border rounded p-1.5" value={editingBooking.owner_name} onChange={e => setEditingBooking({...editingBooking, owner_name: e.target.value})} />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">飼主電話</label>
                  <input type="text" className="w-full border rounded p-1.5" value={editingBooking.owner_phone} onChange={e => setEditingBooking({...editingBooking, owner_phone: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-600">入住日期</label>
                  <input type="date" className="w-full border rounded p-1.5" value={editingBooking.check_in_date} onChange={e => setEditingBooking({...editingBooking, check_in_date: e.target.value})} />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">退房日期</label>
                  <input type="date" className="w-full border rounded p-1.5" value={editingBooking.check_out_date} onChange={e => setEditingBooking({...editingBooking, check_out_date: e.target.value})} />
                </div>
              </div>

              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-2 rounded-xl hover:bg-indigo-700 transition mt-2">
                儲存修改
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 派房彈窗 */}
      {assigningBooking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-bold text-slate-800">為【{assigningBooking.pet_name}】現場拍照與分配籠位</h3>
              <button onClick={() => setAssigningBooking(null)} className="text-slate-400 font-bold">✕</button>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl text-xs space-y-1">
              <div><b>飼主：</b>{assigningBooking.owner_name} ({assigningBooking.owner_phone})</div>
              <div><b>時間：</b>{assigningBooking.check_in_date} ~ {assigningBooking.check_out_date}</div>
              <div><b>自備物品：</b>{assigningBooking.self_provided_items?.details || '無'}</div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">現場拍照點收物品 (自動壓縮)</label>
              <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} disabled={uploading} className="w-full text-xs text-slate-500" />
              {uploading && <p className="text-xs text-amber-600 mt-1">壓縮上傳中...</p>}
              <div className="flex gap-2 mt-2 overflow-x-auto">
                {formData.photo_urls.map((url, i) => (
                  <img key={i} src={url} alt="預覽" className="w-14 h-14 object-cover rounded border" />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">選擇要放入的空籠：</label>
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
            </div>
          </div>
        </div>
      )}

      {/* 20 籠位入住/退房點收 */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h2 className="text-xl font-bold text-slate-800">籠位 {String(selectedRoom.id).padStart(2, '0')} 號</h2>
              <button onClick={() => setSelectedRoom(null)} className="text-slate-400 text-xl font-bold">✕</button>
            </div>

            {selectedRoom.status === 'VACANT' && !showCheckInForm && (
              <div className="text-center py-8">
                <p className="text-slate-500 mb-6">此籠位目前空房中，是否要為現場散客直接辦理入住？</p>
                <button onClick={() => setShowCheckInForm(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl transition inline-flex items-center gap-2">
                  <Plus size={18}/> 填寫現場入住單
                </button>
              </div>
            )}

            {selectedRoom.status === 'OCCUPIED' && currentBooking && (
              <div className="space-y-4 text-sm">
                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/60 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-slate-800">寵物：{currentBooking.pet_name}</span>
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-semibold">{currentBooking.pet_gender} / {currentBooking.pet_age || '未知年齡'}</span>
                  </div>
                  <div className="text-slate-600 flex items-center gap-2"><User size={14}/> 飼主：{currentBooking.owner_name} ({currentBooking.owner_phone})</div>
                  {currentBooking.mi_home_id && <div className="text-xs text-indigo-600 font-medium">📷 米家 ID: {currentBooking.mi_home_id}</div>}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-100 p-2 rounded-lg"><span className="block text-slate-400">飲水</span><b className="text-slate-700 text-sm">{currentBooking.water_tool}</b></div>
                  <div className="bg-slate-100 p-2 rounded-lg"><span className="block text-slate-400">飼料</span><b className="text-slate-700 text-sm">{currentBooking.feed_frequency}</b></div>
                  <div className="bg-slate-100 p-2 rounded-lg"><span className="block text-slate-400">主食草</span><b className="text-slate-700 text-sm">{currentBooking.hay_type}</b></div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border space-y-1">
                  <div className="font-semibold text-slate-700 flex items-center gap-1 mb-1"><Package size={15}/> 自備物品清單：</div>
                  <div className="text-slate-600 whitespace-pre-wrap bg-white p-2.5 rounded border text-xs">{currentBooking.self_provided_items?.details || '未填寫'}</div>
                </div>

                {currentBooking.photo_urls && currentBooking.photo_urls.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-700 flex items-center gap-1 mb-2"><Camera size={15}/> 點收照片紀錄：</div>
                    <div className="grid grid-cols-3 gap-2">
                      {currentBooking.photo_urls.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt="點收照片" className="w-full h-24 object-cover rounded-lg border hover:opacity-80 transition" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={handleCheckOut} className="w-full mt-4 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 rounded-xl transition">
                  辦理退房點收 (自動清理照片)
                </button>
              </div>
            )}

            {selectedRoom.status === 'VACANT' && showCheckInForm && (
              <form onSubmit={handleCheckInSubmit} className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">飼主姓名*</label>
                    <input required type="text" className="w-full border rounded-lg p-2" value={formData.owner_name} onChange={e => setFormData({...formData, owner_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">飼主電話*</label>
                    <input required type="text" className="w-full border rounded-lg p-2" value={formData.owner_phone} onChange={e => setFormData({...formData, owner_phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">寵物姓名*</label>
                    <input required type="text" className="w-full border rounded-lg p-2" value={formData.pet_name} onChange={e => setFormData({...formData, pet_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">寵物年齡</label>
                    <input type="text" className="w-full border rounded-lg p-2" value={formData.pet_age} onChange={e => setFormData({...formData, pet_age: e.target.value})} />
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
                  <label className="block text-slate-600 font-semibold mb-1">自備物品清單</label>
                  <textarea rows="3" className="w-full border rounded-lg p-2" value={formData.self_provided_items} onChange={e => setFormData({...formData, self_provided_items: e.target.value})} />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">現場拍照點收照片</label>
                  <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} disabled={uploading} className="w-full text-xs text-slate-500" />
                </div>

                <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition">
                  確認辦理入住並儲存
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
