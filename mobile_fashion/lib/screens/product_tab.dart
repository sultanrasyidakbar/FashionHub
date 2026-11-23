import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';
import '../utils.dart';
import 'product_detail_screens.dart';
import 'product_form.dart';

class ProductsTab extends StatefulWidget {
  const ProductsTab({super.key});
  @override
  State<ProductsTab> createState() => _ProductsTabState();
}

class _ProductsTabState extends State<ProductsTab> {
  List<Map<String, dynamic>> _products = [], _cats = [];
  int? _catId;
  String _search = '';
  bool _loading = true;
  String? _error;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    dataVersion.addListener(_load);
    _load();
  }

  @override
  void dispose() {
    dataVersion.removeListener(_load);
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final c = await Api.categories();
      final p = await Api.products(search: _search, categoryId: _catId);
      _cats = c;
      _products = p;
    } on ApiException catch (e) {
      _error = e.message;
    }
    if (mounted) setState(() => _loading = false);
  }

  Widget _chip(String label, bool selected, VoidCallback onTap) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: ChoiceChip(
          label: Text(label),
          selected: selected,
          showCheckmark: false,
          selectedColor: kPrimary,
          labelStyle: TextStyle(color: selected ? Colors.white : Colors.black87),
          onSelected: (_) => onTap(),
        ),
      );

  Widget _card(Map<String, dynamic> p) => GestureDetector(
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ProductDetailScreen(id: p['id']))),
        child: Container(
          decoration: cardBox(),
          clipBehavior: Clip.antiAlias,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: ProductImage(url: p['image_url'])),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(p['name'], maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(rupiah(p['price']), style: const TextStyle(color: kPrimary, fontWeight: FontWeight.w700)),
                Text('Stok ${p['stock']}', style: TextStyle(fontSize: 11, color: (p['stock'] as int) <= 5 ? Colors.red : kMuted)),
              ]),
            ),
          ]),
        ),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Produk')),
        floatingActionButton: Api.isAdmin
            ? FloatingActionButton.extended(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ProductFormScreen())),
                icon: const Icon(Icons.add),
                label: const Text('Produk'),
              )
            : null,
        body: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: TextField(
              decoration: const InputDecoration(hintText: 'Cari produk...', prefixIcon: Icon(Icons.search), isDense: true),
              onChanged: (v) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 400), () { _search = v.trim(); _load(); });
              },
            ),
          ),
          SizedBox(
            height: 42,
            child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16), children: [
              _chip('Semua', _catId == null, () { _catId = null; _load(); }),
              for (final c in _cats) _chip(c['name'], _catId == c['id'], () { _catId = c['id']; _load(); }),
            ]),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.cloud_off, size: 48, color: kMuted),
                        Text(_error!),
                        TextButton(onPressed: _load, child: const Text('Coba lagi')),
                      ]))
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: _products.isEmpty
                            ? ListView(children: const [Padding(padding: EdgeInsets.all(64), child: Center(child: Text('Produk tidak ditemukan')))])
                            : GridView.builder(
                                padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.72),
                                itemCount: _products.length,
                                itemBuilder: (_, i) => _card(_products[i]),
                              ),
                      ),
          ),
        ]),
      );
}
