import 'package:flutter/material.dart';
import '../api.dart';
import '../utils.dart';
import 'product_form.dart';

class ProductDetailScreen extends StatefulWidget {
  final int id;
  const ProductDetailScreen({super.key, required this.id});
  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  Map<String, dynamic>? _p;
  String? _error;
  bool _buying = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      _p = await Api.product(widget.id);
    } on ApiException catch (e) {
      _error = e.message;
    }
    if (mounted) setState(() {});
  }

  Future<void> _edit() async {
    final ok = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => ProductFormScreen(product: _p)),
    );
    if (ok == true) _load();
  }

  Future<void> _delete() async {
    if (!await confirmDialog(
      context,
      'Hapus produk?',
      '"${_p!['name']}" akan dihapus permanen.',
    )) {
      return;
    }
    try {
      await Api.deleteProduct(widget.id);
      notifyDataChanged();
      if (!mounted) return;
      Navigator.pop(context);
      notify(context, 'Produk berhasil dihapus');
    } on ApiException catch (e) {
      if (mounted) notify(context, e.message, error: true);
    }
  }

  Future<void> _buy() async {
    setState(() => _buying = true);
    try {
      final result = await Api.buyProduct(widget.id);
      if (!mounted) return;
      setState(() {
        _p = {..._p!, 'stock': result['stock']};
        _buying = false;
      });
      notifyDataChanged();
      notify(context, 'Berhasil membeli ${_p!['name']}');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _buying = false);
      notify(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _p;
    return Scaffold(
      appBar: AppBar(title: const Text('Detail Produk')),
      body: p == null
          ? Center(
              child: _error != null
                  ? Text(_error!)
                  : const CircularProgressIndicator(),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: SizedBox(
                    height: 300,
                    child: ProductImage(url: p['image_url']),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        p['name'],
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    Chip(label: Text(p['category_name'])),
                  ],
                ),
                Text(
                  rupiah(p['price']),
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: kPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(
                      Icons.inventory_2_outlined,
                      size: 18,
                      color: (p['stock'] as int) <= 5 ? Colors.red : kMuted,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Stok: ${p['stock']}${(p['stock'] as int) <= 5 ? ' (menipis)' : ''}',
                      style: TextStyle(
                        color: (p['stock'] as int) <= 5 ? Colors.red : null,
                      ),
                    ),
                  ],
                ),
                const Divider(height: 28),
                const Text(
                  'Deskripsi',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  (p['description'] ?? '').toString().isEmpty
                      ? 'Tidak ada deskripsi'
                      : p['description'],
                ),
                const SizedBox(height: 12),
                Text(
                  'Ditambahkan oleh: ${p['created_by'] ?? '-'}',
                  style: const TextStyle(color: kMuted, fontSize: 12),
                ),
                const SizedBox(height: 22),
                if (!Api.isAdmin)
                  FilledButton.icon(
                    onPressed: (p['stock'] as int) > 0 && !_buying ? _buy : null,
                    icon: _buying
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.shopping_bag_outlined),
                    label: Text(
                      (p['stock'] as int) > 0 ? 'Beli Produk' : 'Stok Habis',
                    ),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(50),
                    ),
                  ),
                if (!Api.isAdmin) const SizedBox(height: 12),
                if (Api.isAdmin)
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _edit,
                          icon: const Icon(Icons.edit),
                          label: const Text('Edit'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size.fromHeight(50),
                            foregroundColor: Colors.red,
                            side: const BorderSide(color: Colors.red),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onPressed: _delete,
                          icon: const Icon(Icons.delete_outline),
                          label: const Text('Hapus'),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
    );
  }
}
