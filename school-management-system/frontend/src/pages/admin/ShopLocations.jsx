import React, { useEffect, useState } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const ShopLocations = () => {
    const confirm = useConfirm();
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingShop, setEditingShop] = useState(null);
    const [form, setForm] = useState({
        shop_name: '',
        shop_type: 'Book Shop',
        address: '',
        city: '',
        contact_number: '',
        google_map_link: '',
    });

    const shopTypes = ['Book Shop', 'Uniform Shop', 'Stationery', 'Other'];

    const fetchShops = async () => {
        setLoading(true);
        try {
            const res = await api.get('shops/');
            setShops(res.data || []);
        } catch (err) {
            toast.error('Failed to fetch shops');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShops();
    }, []);

    const closeForm = () => {
        setShowForm(false);
        setEditingShop(null);
        setForm({
            shop_name: '',
            shop_type: 'Book Shop',
            address: '',
            city: '',
            contact_number: '',
            google_map_link: '',
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.shop_name.trim() || !form.address.trim()) {
            toast.error('Shop name and address are required');
            return;
        }
        setLoading(true);
        try {
            if (editingShop) {
                await api.put(`shops/${editingShop.id}/`, form);
                toast.success('Shop updated successfully');
            } else {
                await api.post('shops/', form);
                toast.success('Shop added successfully');
            }
            closeForm();
            fetchShops();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save shop');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!(await confirm('Are you sure you want to delete this shop?'))) return;
        try {
            await api.delete(`shops/${id}/`);
            toast.success('Shop deleted successfully');
            fetchShops();
        } catch (err) {
            toast.error('Failed to delete shop');
        }
    };

    const startEditing = (shop) => {
        setEditingShop(shop);
        setForm({
            shop_name: shop.shop_name,
            shop_type: shop.shop_type,
            address: shop.address,
            city: shop.city,
            contact_number: shop.contact_number,
            google_map_link: shop.google_map_link || '',
        });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="mx-auto max-w-4xl space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900">Shop Locations</h1>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                            Manage on-campus and affiliated school shops.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {showForm ? (
                            <button
                                type="button"
                                onClick={closeForm}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                            >
                                Close
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => {
                                setEditingShop(null);
                                setForm({
                                    shop_name: '',
                                    shop_type: 'Book Shop',
                                    address: '',
                                    city: '',
                                    contact_number: '',
                                    google_map_link: '',
                                });
                                setShowForm(true);
                            }}
                            className="rounded-2xl bg-school-navy px-5 py-3 text-sm font-black text-white shadow-lg shadow-school-navy/20 hover:opacity-95"
                        >
                            + Add New Shop
                        </button>
                    </div>
                </div>

                {showForm ? (
                    <form
                        onSubmit={handleSubmit}
                        className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm space-y-5 animate-in slide-in-from-top duration-300"
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <h2 className="text-lg font-black text-slate-900">
                                {editingShop ? 'Edit Shop Details' : 'Register New Shop'}
                            </h2>
                            <button type="button" onClick={closeForm} className="text-sm font-bold text-slate-500 hover:text-slate-800">
                                Cancel
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Shop Name</label>
                                <input
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-school-blue/40"
                                    value={form.shop_name}
                                    onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
                                    placeholder="e.g. Modern Book Store"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Shop Type</label>
                                <select
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold bg-white"
                                    value={form.shop_type}
                                    onChange={(e) => setForm({ ...form, shop_type: e.target.value })}
                                >
                                    {shopTypes.map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">City</label>
                                <input
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-school-blue/40"
                                    value={form.city}
                                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                                    placeholder="e.g. New York"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Contact Number</label>
                                <input
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-school-blue/40"
                                    value={form.contact_number}
                                    onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
                                    placeholder="e.g. +1 234 567 890"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Full Address</label>
                            <textarea
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-school-blue/40 min-h-[80px]"
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                placeholder="Full address of the shop..."
                                required
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Google Maps Link (Optional)</label>
                            <input
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-school-blue/40"
                                value={form.google_map_link}
                                onChange={(e) => setForm({ ...form, google_map_link: e.target.value })}
                                placeholder="https://maps.app.goo.gl/..."
                            />
                        </div>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="rounded-2xl bg-school-navy px-6 py-3 text-sm font-black text-white shadow-lg shadow-school-navy/20 hover:opacity-95 disabled:opacity-50"
                            >
                                {loading ? 'Saving…' : editingShop ? 'Save changes' : 'Register Shop'}
                            </button>
                            <button
                                type="button"
                                onClick={closeForm}
                                className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                ) : null}

                {!showForm ? (
                    <div className="space-y-4">
                        <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Registered Shops</h2>
                        
                        {loading && shops.length === 0 ? (
                            <div className="text-sm font-bold text-slate-500 py-10 text-center">Loading…</div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {shops.length === 0 ? (
                                    <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm font-semibold text-slate-500">
                                        No shops registered yet. Use <strong>+ Add New Shop</strong> above.
                                    </div>
                                ) : (
                                    shops.map((shop) => (
                                        <div
                                            key={shop.id}
                                            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-base font-black text-slate-900 break-words">{shop.shop_name}</h3>
                                                        <span className="rounded-full bg-school-blue/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-school-blue">
                                                            {shop.shop_type}
                                                        </span>
                                                    </div>
                                                    <div className="mt-2 space-y-1.5">
                                                        <p className="text-sm font-semibold text-slate-600 flex items-start gap-2">
                                                            <span className="mt-0.5 opacity-50">📍</span>
                                                            {shop.address}, {shop.city}
                                                        </p>
                                                        <p className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                                                            <span className="opacity-50">📞</span>
                                                            {shop.contact_number}
                                                        </p>
                                                    </div>
                                                    {shop.google_map_link && (
                                                        <a
                                                            href={shop.google_map_link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="mt-3 inline-flex items-center gap-2 text-xs font-black text-indigo-600 hover:text-indigo-800"
                                                        >
                                                            🌍 View on Google Maps
                                                        </a>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-2 shrink-0">
                                                    <button
                                                        onClick={() => startEditing(shop)}
                                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(shop.id)}
                                                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default ShopLocations;

