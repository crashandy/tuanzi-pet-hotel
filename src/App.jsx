import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { RefreshCw, Plus, User, Package, Camera, Inbox, LayoutGrid } from 'lucide-react';
import imageCompression from 'browser-image-compression';

export default function App() {
  // 切換頁面模式： 'admin' (店員後台) 或 'customer' (顧客預約)
  const [viewMode, setViewMode] = useState('admin');
  
  const [rooms, setRooms] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]); // 📥 待派房暫存列表
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [currentBooking, setCurrentBooking] = useState(null);
  const [showCheckInForm, setShowCheckInForm] = useState(false);
  const [assigningBooking, setAssigningBooking] = useState(null); // 當前正在分配籠位的暫存預約
  
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
    fetchPendingBookings();
  }, []);

  // 抓取籠位
  const fetchRooms = async () => {
    setLoading(true);
    const { data: roomsData, error } = await supabase
      .from('rooms')
      .select('*')
      .order('id', { ascending: true });

    if (!error) setRooms(roomsData || []);
    setLoading(false);
  };

  // 📥 抓取待派房的暫存預約 (status = 'PENDING')
  const fetchPendingBookings = async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (!error) setPendingBookings(data || []);
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

  // 顧客自主線上預約 (送出至暫存區，不派房、不拍照)
  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('bookings')
        .insert([
          {
            status: 'PENDING', // 標註為暫存
            room_id: null,     // 暫不指派籠位
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

      alert('🎉 預約單已成功送出！請於入住當天至現場由店員為您點收物品與安排籠位。');
      // 重置表單並切換回後台
      setFormData({
        owner_name: '', owner_phone: '', pet_name: '', pet_age: '',
        pet_gender: '公', is_neutered: '已絕育', check_in_date: '', check_out_date: '',
        water_tool: '水碗', feed_frequency: '一天兩次', hay_type: '提摩西',
        mi_home_id: '', self_provided_items: '', photo_urls: []
      });
      fetchPendingBookings();
      setViewMode('admin');
    } catch (err) {
      alert('預約失敗：' + err.message);
    }
  };

  // 店員現場直接辦理入住 (現場填單 + 派房)
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
        ])
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
    } catch (err) {
      alert('入住失敗：' + err.message);
    }
  };

  // 店員將「暫存預約」指派房間並現場補拍照完成入住
  const handleAssignRoom = async (bookingId, targetRoomId) => {
    try {
      // 1. 更新預約單狀態為 CONFIRMED 並寫入 room_id
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          status: 'CONFIRMED',
          room_id: targetRoomId,
          photo_urls: formData.photo_urls // 寫入現場拍的照片
        })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      // 2. 更新籠位為 OCCUPIED
      await supabase
        .from('rooms')
        .update({ status: 'OCCUPIED', current_booking_id: bookingId })
        .eq('id', targetRoomId);

      alert(`成功指派至籠位 ${targetRoomId} 號，完成入住！`);
      setAssigningBooking(null);
      fetchRooms();
      fetchPendingBookings();
    } catch (err) {
      alert('指派失敗：' + err
