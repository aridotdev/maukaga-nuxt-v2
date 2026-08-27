<script setup>
import { ref } from 'vue';

definePageMeta({
  layout: 'false'
});


// Dummy Data berdasarkan PRD
const statistics = ref([
  { label: 'Total Pengajuan', value: '1,284', icon: 'ph-folders', bgDecoration: 'bg-blue-300/40' },
  { label: 'Pengajuan Baru', value: '24', icon: 'ph-file-plus', bgDecoration: 'bg-sky-300/40' },
  { label: 'Disetujui (Siap Cetak)', value: '85', icon: 'ph-check-circle', bgDecoration: 'bg-green-300/40' },
  { label: 'Selesai', value: '1,150', icon: 'ph-flag-checkered', bgDecoration: 'bg-indigo-300/40' },
]);

const pendingReviewCount = ref(3);

const reviewQueue = ref([
  { model: 'LED-TV-42INCH-X', source: 'Manual', usulan: 'TV LED 42 Inch Seri X' },
  { model: 'AC-SPLIT-1/2PK-INV', source: 'Manual', usulan: 'AC Split Inverter 0.5 PK' },
  { model: 'WM-FRONT-8KG-WHT', source: 'Manual', usulan: 'Mesin Cuci Front Load 8kg Putih' },
]);

const chartData = ref([
  { month: 'Nov', height: '40%', value: 120, active: false },
  { month: 'Des', height: '55%', value: 165, active: false },
  { month: 'Jan', height: '45%', value: 135, active: false },
  { month: 'Feb', height: '70%', value: 210, active: false },
  { month: 'Mar', height: '60%', value: 180, active: false },
  { month: 'Apr', height: '85%', value: 255, active: false },
  { month: 'Mei', height: '90%', value: 284, active: true },
]);

const submissions = ref([
  { id: 'KG-20260531-0005', time: '31 Mei 2026 10:30', name: 'Budi Santoso', branch: 'Cabang Jakarta Pusat', items: 3, status: 'Baru' },
  { id: 'KG-20260530-0042', time: '30 Mei 2026 15:45', name: 'Siti Aminah', branch: 'Cabang Surabaya', items: 1, status: 'Disetujui' },
  { id: 'KG-20260530-0012', time: '30 Mei 2026 09:15', name: 'Andi Wijaya', branch: 'Cabang Bandung', items: 5, status: 'Ditolak' },
  { id: 'KG-20260529-0088', time: '29 Mei 2026 14:20', name: 'Rina Kusuma', branch: 'Cabang Medan', items: 2, status: 'Selesai' },
  { id: 'KG-20260529-0056', time: '29 Mei 2026 11:10', name: 'Hendra Saputra', branch: 'Cabang Semarang', items: 4, status: 'Selesai' },
]);

const getStatusClass = (status) => {
  switch (status) {
    case 'Baru': return 'bg-sky-100/80 text-sky-700 border-sky-200';
    case 'Disetujui': return 'bg-green-100/80 text-green-700 border-green-200';
    case 'Ditolak': return 'bg-red-100/80 text-red-700 border-red-200';
    case 'Selesai': return 'bg-slate-200/80 text-slate-700 border-slate-300';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};
</script>

<template>
  <div class="bg-[#f4f7fb] text-slate-700 font-sans antialiased relative min-h-screen overflow-x-hidden selection:bg-[#0a192f] selection:text-white z-0">
    
    <!-- Decorative Animated Background Blobs -->
    <div class="fixed top-[-10%] left-[-5%] w-160 h-160 bg-blue-200/50 rounded-full mix-blend-multiply filter blur-[100px] animate-blob -z-10 pointer-events-none"/>
    <div class="fixed top-[20%] right-[-10%] w-160 h-160 bg-indigo-200/50 rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-2000 -z-10 pointer-events-none"/>
    <div class="fixed bottom-[-20%] left-[20%] w-160 h-160 bg-sky-200/50 rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-4000 -z-10 pointer-events-none"/>

    <!-- Main Layout Wrapper -->
    <div class="relative flex w-full max-w-400 mx-auto p-4 sm:p-6 lg:p-8 gap-8 min-h-screen">
      
      <!-- Sidebar Navigation -->
      <aside class="hidden lg:flex flex-col w-72 glass-panel rounded-[2.5rem] p-6 h-[calc(100vh-4rem)] sticky top-8">
        <!-- Logo -->
        <div class="flex items-center gap-3 px-2 mb-10">
          <div class="w-10 h-10 rounded-xl bg-[#0a192f] flex items-center justify-center text-white shadow-lg shadow-[#0a192f]/20">
            <i class="ph-bold ph-shield-check text-2xl"/>
          </div>
          <span class="text-xl font-bold text-[#0a192f] tracking-tight">Mau KaGa</span>
        </div>

        <!-- Nav Links -->
        <nav class="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
          <p class="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 mt-2">Menu Utama</p>
          <a href="#" class="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/60 text-[#0a192f] font-semibold shadow-sm transition-all border border-white/80">
            <i class="ph ph-squares-four text-xl"/>
            Dasbor Utama
          </a>
          <a href="#" class="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-slate-500 hover:bg-white/40 hover:text-[#0a192f] transition-all font-medium">
            <i class="ph ph-list-magnifying-glass text-xl"/>
            Review Produk
            <span v-if="pendingReviewCount > 0" class="ml-auto bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-[10px] font-bold">{{ pendingReviewCount }}</span>
          </a>
          <a href="#" class="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-slate-500 hover:bg-white/40 hover:text-[#0a192f] transition-all font-medium">
            <i class="ph ph-printer text-xl"/>
            Antrean Cetak
          </a>
          <a href="#" class="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-slate-500 hover:bg-white/40 hover:text-[#0a192f] transition-all font-medium">
            <i class="ph ph-tag text-xl"/>
            Label Cabang
          </a>

          <p class="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 mt-8">Pengaturan</p>
          <a href="#" class="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-slate-500 hover:bg-white/40 hover:text-[#0a192f] transition-all font-medium">
            <i class="ph ph-layout text-xl"/>
            Layout Cetak
          </a>
          <a href="#" class="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-slate-500 hover:bg-white/40 hover:text-[#0a192f] transition-all font-medium">
            <i class="ph ph-users text-xl"/>
            Manajemen User
          </a>
        </nav>

        <!-- User Profile Snippet -->
        <div class="mt-auto pt-6 border-t border-white/50">
          <div class="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/40 transition-colors cursor-pointer group">
            <div class="w-10 h-10 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[#0a192f] font-bold">
              A
            </div>
            <div class="flex-1 overflow-hidden">
              <p class="text-sm font-semibold text-[#0a192f] truncate">Admin Pusat</p>
              <p class="text-xs text-slate-500 truncate">Controller</p>
            </div>
            <i class="ph ph-sign-out text-slate-400 group-hover:text-red-500 transition-colors"/>
          </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="flex-1 flex flex-col gap-8 w-full max-w-full">
        
        <!-- Header Topbar -->
        <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/30 backdrop-blur-md border border-white/50 p-4 sm:px-8 sm:py-5 rounded-3xl shadow-sm z-10">
          <div>
            <h1 class="text-2xl font-bold text-[#0a192f]">Halo, Admin! 👋</h1>
            <p class="text-sm text-slate-500 mt-1">Pantau pengajuan kartu garansi dan antrean cetak hari ini.</p>
          </div>
          
          <div class="flex items-center gap-4 w-full sm:w-auto">
            <div class="relative flex-1 sm:w-64">
              <i class="ph ph-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"/>
              <input type="text" placeholder="Cari ID Pengajuan..." class="w-full bg-white/50 border border-white/60 focus:border-[#0a192f]/40 focus:bg-white/80 rounded-full py-2.5 pl-11 pr-4 text-sm outline-none transition-all placeholder:text-slate-400 text-[#0a192f] shadow-inner">
            </div>
            <button class="relative p-2.5 rounded-full bg-white/50 border border-white/60 text-[#0a192f] hover:bg-white/80 transition-all shadow-sm">
              <i class="ph ph-bell text-xl"/>
              <span class="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"/>
            </button>
          </div>
        </header>

        <!-- Key Metrics Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 z-10">
          <div v-for="(stat, index) in statistics" :key="index" class="glass-card rounded-4xl p-6 relative overflow-hidden group">
            <div class="flex justify-between items-start mb-4">
              <div class="w-12 h-12 rounded-2xl bg-white/60 flex items-center justify-center text-[#0a192f] border border-white/80 shadow-sm">
                <i :class="['ph text-2xl', stat.icon]"/>
              </div>
            </div>
            <div>
              <p class="text-sm font-medium text-slate-500 mb-1">{{ stat.label }}</p>
              <h3 class="text-3xl font-bold text-[#0a192f]">{{ stat.value }}</h3>
            </div>
            <div :class="['absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500', stat.bgDecoration]"/>
          </div>
        </div>

        <!-- Charts & Side Queue Section -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 z-10 flex-1">
          
          <!-- Main Chart Mockup -->
          <div class="lg:col-span-2 glass-panel rounded-[2.5rem] p-8 flex flex-col">
            <div class="flex justify-between items-center mb-8">
              <div>
                <h2 class="text-xl font-bold text-[#0a192f]">Statistik Pengajuan</h2>
                <p class="text-sm text-slate-500 mt-1">Tren pengajuan kartu garansi 7 bulan terakhir</p>
              </div>
              <select class="bg-white/50 border border-white/60 text-sm text-[#0a192f] rounded-xl px-4 py-2 outline-none appearance-none cursor-pointer hover:bg-white/80 transition-colors shadow-sm">
                <option>Tahun Ini</option>
                <option>Tahun Lalu</option>
              </select>
            </div>

            <div class="flex-1 flex items-end justify-between gap-2 sm:gap-4 mt-auto h-64 relative border-b border-white/40 pb-2">
              <div class="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-slate-400 font-medium pb-2 w-10">
                <span>400</span>
                <span>300</span>
                <span>200</span>
                <span>100</span>
              </div>
              
              <div class="flex-1 flex items-end justify-between gap-2 sm:gap-6 ml-12 h-full">
                <div v-for="(bar, idx) in chartData" :key="idx" class="group w-full flex flex-col items-center gap-3">
                  <div :class="['w-full max-w-12 border border-white/50 rounded-t-xl relative transition-all duration-300 overflow-hidden flex items-end', bar.active ? 'bg-[#0a192f] shadow-[0_0_20px_rgba(10,25,47,0.2)] h-[90%] group-hover:h-[95%]' : 'bg-white/40 group-hover:bg-white/70 h-[' + bar.height + ']']" :style="{ height: bar.active ? '90%' : bar.height }">
                    <div v-if="!bar.active" class="w-full bg-[#0a192f]/30 h-full rounded-t-xl"/>
                    <!-- Tooltip -->
                    <div class="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#0a192f] text-white text-xs py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg z-20">
                      {{ bar.value }} Pengajuan
                    </div>
                  </div>
                  <span :class="['text-xs', bar.active ? 'font-bold text-[#0a192f]' : 'font-semibold text-slate-500']">{{ bar.month }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Product Review Queue -->
          <div class="glass-panel rounded-[2.5rem] p-8 flex flex-col">
            <div class="flex justify-between items-center mb-6">
              <div>
                <h2 class="text-xl font-bold text-[#0a192f]">Antrean Review Produk</h2>
                <p class="text-xs text-slate-500 mt-1">Model baru menunggu verifikasi</p>
              </div>
              <div class="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
                {{ pendingReviewCount }} Pending
              </div>
            </div>

            <div class="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
              <div v-for="(item, idx) in reviewQueue" :key="idx" class="flex flex-col gap-2 p-4 rounded-2xl bg-white/40 hover:bg-white/60 transition-colors border border-white/60">
                <div class="flex justify-between items-start">
                  <div class="flex items-center gap-2">
                    <i class="ph-fill ph-warning-circle text-amber-500 text-lg"/>
                    <h4 class="text-sm font-bold text-[#0a192f]">{{ item.model }}</h4>
                  </div>
                  <span class="text-[10px] uppercase font-bold tracking-wider text-slate-400">{{ item.source }}</span>
                </div>
                <p class="text-xs text-slate-600 line-clamp-1"><span class="font-medium text-slate-400">Usulan:</span> {{ item.usulan }}</p>
                <div class="mt-2 flex gap-2">
                  <button class="flex-1 py-1.5 bg-[#0a192f] text-white text-xs font-semibold rounded-lg hover:bg-[#0a192f]/90 transition-colors">Review</button>
                </div>
              </div>
            </div>
            
            <button class="mt-auto pt-4 w-full text-[#0a192f] font-semibold text-sm hover:underline flex items-center justify-center gap-2">
              Lihat Semua Antrean <i class="ph ph-arrow-right"/>
            </button>
          </div>
        </div>

        <!-- Main Data Table (Pengajuan Final) -->
        <div class="glass-panel rounded-[2.5rem] p-8 overflow-hidden z-10 mb-8">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <div>
              <h2 class="text-xl font-bold text-[#0a192f]">Daftar Pengajuan Final</h2>
              <p class="text-sm text-slate-500 mt-1">Status: Baru, Disetujui, Ditolak, Selesai</p>
            </div>
            <div class="flex gap-2">
              <button class="bg-white/50 border border-white/60 px-4 py-2 rounded-xl text-sm font-medium text-[#0a192f] hover:bg-white/80 transition-colors shadow-sm flex items-center gap-2">
                <i class="ph ph-funnel"/> Filter
              </button>
            </div>
          </div>

          <div class="overflow-x-auto custom-scrollbar pb-4">
            <table class="w-full text-left border-collapse whitespace-nowrap min-w-200">
              <thead>
                <tr class="border-b border-white/40">
                  <th class="pb-4 pt-2 px-4 font-semibold text-xs text-slate-500 uppercase tracking-wider">ID Pengajuan</th>
                  <th class="pb-4 pt-2 px-4 font-semibold text-xs text-slate-500 uppercase tracking-wider">Waktu Submit</th>
                  <th class="pb-4 pt-2 px-4 font-semibold text-xs text-slate-500 uppercase tracking-wider">Nama & Cabang</th>
                  <th class="pb-4 pt-2 px-4 font-semibold text-xs text-slate-500 uppercase tracking-wider text-center">Jml Item</th>
                  <th class="pb-4 pt-2 px-4 font-semibold text-xs text-slate-500 uppercase tracking-wider">Status</th>
                  <th class="pb-4 pt-2 px-4 font-semibold text-xs text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="text-sm">
                <tr v-for="(row, idx) in submissions" :key="idx" class="border-b border-white/20 hover:bg-white/30 transition-colors group">
                  <td class="py-4 px-4 font-bold text-[#0a192f]">{{ row.id }}</td>
                  <td class="py-4 px-4 text-slate-500">{{ row.time }}</td>
                  <td class="py-4 px-4">
                    <p class="font-semibold text-[#0a192f]">{{ row.name }}</p>
                    <p class="text-xs text-slate-500">{{ row.branch }}</p>
                  </td>
                  <td class="py-4 px-4 text-center font-medium text-slate-700">{{ row.items }}</td>
                  <td class="py-4 px-4">
                    <span :class="['px-3 py-1.5 rounded-full text-xs font-bold border', getStatusClass(row.status)]">
                      {{ row.status }}
                    </span>
                  </td>
                  <td class="py-4 px-4 text-right">
                    <button class="px-3 py-1.5 bg-white/60 border border-white/80 rounded-lg text-sm font-medium text-[#0a192f] hover:bg-white shadow-sm transition-all">
                      Detail
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Pagination Mockup -->
          <div class="flex justify-between items-center mt-4 pt-4 border-t border-white/30">
            <p class="text-xs text-slate-500">Menampilkan 1-5 dari 124 pengajuan</p>
            <div class="flex gap-1">
              <button class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/40 text-slate-400 cursor-not-allowed"><i class="ph ph-caret-left"/></button>
              <button class="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0a192f] text-white font-medium shadow-md">1</button>
              <button class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/60 hover:bg-white text-[#0a192f] font-medium transition-colors">2</button>
              <button class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/60 hover:bg-white text-[#0a192f] font-medium transition-colors">3</button>
              <button class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/60 hover:bg-white text-[#0a192f] transition-colors"><i class="ph ph-caret-right"/></button>
            </div>
          </div>
        </div>

      </main>
    </div>
  </div>
</template>

<style scoped>
/* Ensure Plus Jakarta Sans is imported globally in your App.vue or index.html */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

/* Requires Phosphor Icons script in index.html for icons:
   <script src="https://unpkg.com/@phosphor-icons/web"></script> 
*/

.font-sans {
  font-family: 'Plus Jakarta Sans', sans-serif;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 8px 32px 0 rgba(10, 25, 47, 0.05);
}

.glass-card {
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 4px 24px -1px rgba(10, 25, 47, 0.03);
  transition: transform 0.2s ease, background 0.2s ease;
}

.glass-card:hover {
  background: rgba(255, 255, 255, 0.45);
  transform: translateY(-2px);
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(10, 25, 47, 0.1);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(10, 25, 47, 0.2);
}

/* Background Animation */
@keyframes blob {
  0% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0px, 0px) scale(1); }
}

.animate-blob {
  animation: blob 10s infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

.animation-delay-4000 {
  animation-delay: 4s;
}
</style>