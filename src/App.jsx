import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { RefreshCw, Plus, User, Package, Camera } from 'lucide-react';
import imageCompression from 'browser-image-compression';

export default function App() {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [showCheckInForm, setShowCheckInForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // 表單資料狀態
  const [formData, setFormData] = useState({
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

  // ✨ 功能 1：自動壓縮圖片並上傳
  const handleFileUpload = async (event) => {
    try {
      setUploading(true);
      const imageFile = event.target.files[0];
      if (!imageFile) return;

      // 圖片壓縮設定
      const options = {
        maxSizeMB: 0.3,          // 最大限制 0.3MB (約 300KB)
        maxWidthOrHeight: 1200,  // 最大寬/高 1200px
        useWebWorker: true
      };

      // 執行壓縮
      const compressedFile = await imageCompression(imageFile, options);

      // 上傳壓縮後的圖片
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('pet-items')
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

      // 取得公開網址
      const { data } = supabase.storage
        .from('pet-items')
        .getPublicUrl(fileName);

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

  // 辦理入住
  const handleCheckInSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert([
          {
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
        ])
        .select()
        .single();

      if (bookingError) throw bookingError;

      const { error: roomError } = await supabase
        .from('rooms')
        .update({
          status: 'OCCUPIED',
          current_booking_id: bookingData.id
        })
        .eq('id', selectedRoom.id);

      if (roomError) throw roomError;

      alert(`籠位 ${selectedRoom.id} 號辦理入住成功！`);
      setShowCheckInForm(false);
      setSelectedRoom(null);
      // 重置表單
      setFormData({
        owner_name: '', owner_phone: '', pet_name: '', pet_age: '',
        pet_gender: '公', is_neutered: '已絕育', check_in_date: '', check_out_date: '',
        water_tool: '水碗', feed_frequency: '一天兩次', hay_type: '提摩西',
        mi_home_id: '', self_provided_items: '', photo_urls: []
      });
      fetchRooms();
    } catch (err) {
      alert('入住失敗：' + err.message);
    }
  };

  // ✨ 功能 2：辦理退房並自動清理雲端照片
  const handleCheckOut = async () => {
    if (!window.confirm(`確定要為籠位 ${selectedRoom.id} 辦理退房點收嗎？(系統將同步清理本次入住的照片以節省雲端空間)`)) return;

    try {
      // 1. 如果有照片，解析檔名並從 Supabase Storage 刪除
      if (currentBooking && currentBooking.photo_urls && currentBooking.photo_urls.length > 0) {
        const filesToDelete = currentBooking.photo_urls.map(url => {
          const parts = url.split('/');
          return parts[parts.length - 1];
        });

        const { error: deletePhotosError } = await supabase.storage
          .from('pet-items')
          .remove(filesToDelete);

        if (deletePhotosError) {
          console.warn('部分照片刪除失敗:', deletePhotosError.message);
        }
      }

      // 2. 更新籠位狀態為空房 (VACANT)
      const { error } = await supabase
        .from('rooms')
        .update({
          status: 'VACANT',
          current_booking_id: null
        })
        .eq('id', selectedRoom.id);

      if (error) throw error;

      alert(`籠位 ${selectedRoom.id} 已順利退房，照片紀錄已自動清理釋放空間！`);
      setSelectedRoom(null);
      fetchRooms();
    } catch (err) {
      alert('退房失敗：' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50/40 p-4 md:p-8 font-sans">
      <header className="max-w-7xl mx-auto mb-6 flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-amber-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🐰 糰子兔 - 住宿管理看板</h1>
          <p className="text-sm text-slate-500 mt-1">兔子 / 龍貓 / 天竺鼠 專屬照顧與自備物品點收系統</p>
        </div>
        <button onClick={fetchRooms} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition">
          <RefreshCw size={16} /> 重新整理
        </button>
      </header>

      {/* 20 個籠位看板 */}
      <main className="max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-slate-400 font-medium">資料載入中...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
            {rooms.map((room) => {
              const isOccupied = room.status === 'OCCUPIED';
              return (
                <div
                  key={room.id}
                  onClick={() => handleRoomClick(room)}
                  className={`cursor-pointer rounded-2xl p-4 border-2 transition-all hover:shadow-md ${
                    isOccupied ? 'bg-rose-50/70 border-rose-200 hover:border-rose-400' : 'bg-white border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-lg text-slate-700">籠位 {String(room.id).padStart(2, '0')}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isOccupied ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {isOccupied ? '入住中' : '空房'}
                    </span>
                  </div>
                  {isOccupied ? (
                    <div className="text-sm space-y-1">
                      <div className="font-bold text-rose-900">🐾 點擊查看住客資料</div>
                      <div className="text-xs text-slate-500">確認照片與物品清單</div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 py-4 text-center flex items-center justify-center gap-1 font-medium">
                      <Plus size={14}/> 辦理入住
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 詳情與表單彈窗 */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h2 className="text-xl font-bold text-slate-800">籠位 {String(selectedRoom.id).padStart(2, '0')} 號</h2>
              <button onClick={() => setSelectedRoom(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            {selectedRoom.status === 'VACANT' && !showCheckInForm && (
              <div className="text-center py-8">
                <p className="text-slate-500 mb-6">此籠位目前空房中，是否要為顧客辦理入住？</p>
                <button onClick={() => setShowCheckInForm(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl transition inline-flex items-center gap-2">
                  <Plus size={18}/> 開始填寫入住資料
                </button>
              </div>
            )}

            {/* 查看入住中資料 */}
            {selectedRoom.status === 'OCCUPIED' && currentBooking && (
              <div className="space-y-4 text-sm">
                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/60 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-slate-800">寵物：{currentBooking.pet_name}</span>
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-semibold">{currentBooking.pet_gender} / {currentBooking.pet_age || '未知年齡'}</span>
                  </div>
                  <div className="text-slate-600 flex items-center gap-2">
                    <User size={14}/> 飼主：{currentBooking.owner_name} ({currentBooking.owner_phone})
                  </div>
                  {currentBooking.mi_home_id && (
                    <div className="text-xs text-indigo-600 font-medium">📷 米家 ID: {currentBooking.mi_home_id}</div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-100 p-2 rounded-lg"><span className="block text-slate-400">飲水</span><b className="text-slate-700 text-sm">{currentBooking.water_tool}</b></div>
                  <div className="bg-slate-100 p-2 rounded-lg"><span className="block text-slate-400">飼料</span><b className="text-slate-700 text-sm">{currentBooking.feed_frequency}</b></div>
                  <div className="bg-slate-100 p-2 rounded-lg"><span className="block text-slate-400">主食草</span><b className="text-slate-700 text-sm">{currentBooking.hay_type}</b></div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border space-y-1">
                  <div className="font-semibold text-slate-700 flex items-center gap-1 mb-1"><Package size={15}/> 自備物品清單：</div>
                  <div className="text-slate-600 whitespace-pre-wrap bg-white p-2.5 rounded border text-xs">
                    {currentBooking.self_provided_items?.details || '未填寫自備物品'}
                  </div>
                </div>

                {/* 照片紀錄 */}
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

                <div className="text-xs text-slate-500 bg-slate-100 p-2.5 rounded-lg flex justify-between">
                  <span>入住日期：{currentBooking.check_in_date}</span>
                  <span>退房日期：{currentBooking.check_out_date}</span>
                </div>

                <button onClick={handleCheckOut} className="w-full mt-4 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 rounded-xl transition">
                  辦理退房點收 (自動清理照片)
                </button>
              </div>
            )}

            {/* 填寫入住表單 */}
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
                    <label className="block text-slate-600 font-semibold mb-1">飲水方式</label>
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
                    <label className="block text-slate-600 font-semibold mb-1">入住日期*</label>
                    <input required type="date" className="w-full border rounded-lg p-2" value={formData.check_in_date} onChange={e => setFormData({...formData, check_in_date: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">預計退房日期*</label>
                    <input required type="date" className="w-full border rounded-lg p-2" value={formData.check_out_date} onChange={e => setFormData({...formData, check_out_date: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">米家 ID</label>
                  <input type="text" placeholder="主人連線攝影機帳號" className="w-full border rounded-lg p-2" value={formData.mi_home_id} onChange={e => setFormData({...formData, mi_home_id: e.target.value})} />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">自備物品清單 (防漏點收)</label>
                  <textarea rows="3" placeholder="例如：自備飼料1包、草架1個、便盆1個、維他命1瓶" className="w-full border rounded-lg p-2 bg-amber-50/40" value={formData.self_provided_items} onChange={e => setFormData({...formData, self_provided_items: e.target.value})} />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">現場拍照/上傳物品照片 (自動壓縮)</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    onChange={handleFileUpload} 
                    disabled={uploading} 
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200" 
                  />
                  {uploading && <p className="text-xs text-amber-600 mt-1 animate-pulse">⚡ 圖片壓縮並上傳中...</p>}
                  
                  {formData.photo_urls.length > 0 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto">
                      {formData.photo_urls.map((url, i) => (
                        <img key={i} src={url} alt="預覽" className="w-16 h-16 object-cover rounded-lg border" />
                      ))}
                    </div>
                  )}
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
