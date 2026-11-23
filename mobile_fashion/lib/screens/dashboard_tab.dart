import 'package:flutter/material.dart';
import '../api.dart';
import '../utils.dart';
import 'product_detail_screens.dart';

class DashboardTab extends StatefulWidget {
  final void Function(int) goTo;
  const DashboardTab({super.key, required this.goTo});
  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  List<Map<String, dynamic>> _products = [], _cats = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    dataVersion.addListener(_load);
    _load();
  }

  @override
  void dispose() {
    dataVersion.removeListener(_load);
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final p = await Api.products();
      final c = await Api.categories();
      _products = p;
      _cats = c;
    } on ApiException catch (e) {
      _error = e.message;
    }
    if (mounted) setState(() => _loading = false);
  }

  Widget _stat(String label, String value, IconData icon, {bool warn = false}) => Container(
        padding: const EdgeInsets.all(14),
        decoration: cardBox(),
        child: Row(children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: warn ? const Color(0xFFFDE8E8) : const Color(0xFFE3EAF8), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: warn ? Colors.red : kPrimary),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              Text(label, style: const TextStyle(fontSize: 12, color: kMuted)),
            ]),
          ),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final totalStock = _products.fold<int>(0, (s, p) => s + (p['stock'] as int));
    final stockValue = _products.fold<num>(0, (s, p) => s + (p['price'] as num) * (p['stock'] as int));
    final low = _products.where((p) => (p['stock'] as int) <= 5).length;
    final name = (Api.user?['name'] ?? '').toString();

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Halo, ${name.split(' ').first}!', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                RoleBadge(Api.user?['role'] ?? ''),
              ]),
            ),
            CircleAvatar(radius: 22, backgroundColor: kPrimary, child: Text(name.isEmpty ? '?' : name[0].toUpperCase(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
          ]),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator()))
          else if (_error != null)
            Padding(
              padding: const EdgeInsets.all(32),
              child: Column(children: [
                const Icon(Icons.cloud_off, size: 48, color: kMuted),
                const SizedBox(height: 8),
                Text(_error!, textAlign: TextAlign.center),
                TextButton(onPressed: _load, child: const Text('Coba lagi')),
              ]),
            )
          else ...[
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [kPrimaryDark, kPrimary]),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Total Nilai Stok', style: TextStyle(color: Color(0xCCFFFFFF))),
                const SizedBox(height: 4),
                Text(rupiah(stockValue), style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text('${_products.length} produk di ${_cats.length} kategori', style: const TextStyle(color: Color(0xCCFFFFFF), fontSize: 12)),
              ]),
            ),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 2.1,
              children: [
                _stat('Total Produk', '${_products.length}', Icons.inventory_2_outlined),
                _stat('Stok Tersedia', '$totalStock', Icons.warehouse_outlined),
                _stat('Stok Menipis', '$low', Icons.warning_amber_rounded, warn: low > 0),
                _stat('Kategori', '${_cats.length}', Icons.category_outlined),
              ],
            ),
            const SizedBox(height: 18),
            Row(children: [
              const Expanded(child: Text('Produk Terbaru', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
              TextButton(onPressed: () => widget.goTo(1), child: const Text('Lihat Semua')),
            ]),
            if (_products.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('Belum ada produk'))),
            for (final p in _products.take(5))
              GestureDetector(
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ProductDetailScreen(id: p['id']))),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(10),
                  decoration: cardBox(),
                  child: Row(children: [
                    ClipRRect(borderRadius: BorderRadius.circular(10), child: SizedBox(width: 56, height: 56, child: ProductImage(url: p['image_url']))),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(p['name'], maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                        Text('${p['category_name']} • Stok ${p['stock']}', style: TextStyle(fontSize: 12, color: (p['stock'] as int) <= 5 ? Colors.red : kMuted)),
                      ]),
                    ),
                    Text(rupiah(p['price']), style: const TextStyle(color: kPrimary, fontWeight: FontWeight.w700)),
                  ]),
                ),
              ),
          ],
        ]),
      ),
    );
  }
}
