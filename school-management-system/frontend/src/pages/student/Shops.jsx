import React, { useEffect, useState } from "react";
import api from "../../services/api";

const Shops = () => {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchShops = async () => {
    setLoading(true);
    try {
      const res = await api.get("shops/");
      setShops(res.data);
    } catch (err) {
      console.error("Failed to fetch shops", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  const getTypeIcon = (type) => {
    switch (type) {
      case "Book Shop":
        return "📚";
      case "Uniform Shop":
        return "👔";
      case "Stationery":
        return "✏️";
      default:
        return "🏪";
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-10 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="text-center md:text-left space-y-2">
        <h1 className="text-4xl font-black text-school-navy tracking-tight">
          Shop Locations
        </h1>
        <p className="text-slate-400 font-medium max-w-2xl">
          Find your school books, uniforms, and other essential items at these
          locations.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 grayscale opacity-30">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-school-navy rounded-full animate-spin"></div>
          <p className="mt-4 font-bold text-xs uppercase tracking-widest text-slate-400">
            Syncing with system...
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {shops.map((shop) => (
            <div
              key={shop.id}
              className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 hover:shadow-2xl hover:shadow-slate-200/50 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>

              <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">
                    {getTypeIcon(shop.shop_type)}
                  </div>
                  <span className="text-[10px] font-black text-school-blue bg-school-blue/5 px-4 py-2 rounded-full uppercase tracking-tighter shadow-sm">
                    {shop.shop_type}
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-black text-school-navy">
                    {shop.shop_name}
                  </h3>
                  <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">
                    {shop.city}
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-50">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-sm grayscale opacity-50 text-slate-400">
                      📍
                    </div>
                    <p className="text-sm font-semibold text-school-body leading-relaxed">
                      {shop.address}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-sm grayscale opacity-50 text-slate-400">
                      📞
                    </div>
                    <p className="text-sm font-bold text-school-navy">
                      {shop.contact_number}
                    </p>
                  </div>
                </div>

                {shop.google_map_link && (
                  <a
                    href={shop.google_map_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full py-4 bg-school-navy text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-school-navy/10 hover:shadow-2xl transition-all active:scale-[0.98]"
                  >
                    🌍 View on Map
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && shops.length === 0 && (
        <div className="py-32 text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="text-6xl mb-6 grayscale opacity-20">🏪</div>
          <h3 className="text-xl font-black text-school-navy">
            No Shops Listed
          </h3>
          <p className="text-slate-400 font-medium max-w-sm mx-auto mt-2 leading-relaxed">
            Currently there are no shop locations registered in your area.
            Contact the school admin for more information.
          </p>
        </div>
      )}
    </div>
  );
};

export default Shops;
