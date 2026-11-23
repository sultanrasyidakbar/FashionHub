import 'package:flutter/material.dart';
import '../api.dart';
import '../utils.dart';

// Semua role boleh melihat; hanya admin yang melihat tombol tambah/edit/hapus.
class CategoriesTab extends StatefulWidget {
  const CategoriesTab({super.key});
  @override
  State<CategoriesTab> createState() => _CategoriesTabState();
}

class _CategoriesTabState extends State<CategoriesTab> {
  List<Map<String, dynamic>> _cats = [];
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
      _cats = await Api.categories();
    } on ApiException catch (e) {
      _error = e.message;
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _form([Map<String, dynamic>? c]) async {
    final name = TextEditingController(text: c?['name']);
    final desc = TextEditingController(text: c?['description']);
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(c == null ? 'Tambah Kategori' : 'Edit Kategori'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: name, decoration: const InputDecoration(labelText: 'Nama')),
          const SizedBox(height: 10),
          TextField(controller: desc, decoration: const InputDecoration(labelText: 'Deskripsi')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Batal')),
          FilledButton(style: FilledButton.styleFrom(minimumSize: const Size(90, 42)), onPressed: () => Navigator.pop(context, true), child: const Text('Simpan')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final msg = await Api.saveCategory(id: c?['id'], name: name.text.trim(), description: desc.text.trim());
      if (mounted) notify(context, msg);
      notifyDataChanged();
    } on ApiException catch (e) {
      if (mounted) notify(context, e.message, error: true);
    }
  }

  Future<void> _delete(Map<String, dynamic> c) async {
    if (!await confirmDialog(context, 'Hapus kategori?', 'Kategori "${c['name']}" akan dihapus.')) return;
    try {
      await Api.deleteCategory(c['id']);
      if (mounted) notify(context, 'Kategori dihapus');
      notifyDataChanged();
    } on ApiException catch (e) {
      if (mounted) notify(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Kategori'),
          actions: [
            if (Api.isAdmin)
              IconButton(
                icon: const CircleAvatar(radius: 14, backgroundColor: kPrimary, child: Icon(Icons.add, size: 18, color: Colors.white)),
                onPressed: () => _form(),
              ),
          ],
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(_error!), TextButton(onPressed: _load, child: const Text('Coba lagi'))]))
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: [
                      for (final c in _cats)
                        Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(12),
                          decoration: cardBox(),
                          child: Row(children: [
                            Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(color: const Color(0xFFE3EAF8), borderRadius: BorderRadius.circular(12)),
                              child: const Icon(Icons.checkroom, color: kPrimary),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(c['name'], style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                                Text('${c['product_count']} Produk', style: const TextStyle(color: kMuted, fontSize: 12)),
                                if ((c['description'] ?? '').toString().isNotEmpty)
                                  Text(c['description'], maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: kMuted, fontSize: 12)),
                              ]),
                            ),
                            if (Api.isAdmin) ...[
                              IconButton(icon: const Icon(Icons.edit_outlined), onPressed: () => _form(c)),
                              IconButton(icon: const Icon(Icons.delete_outline, color: Colors.red), onPressed: () => _delete(c)),
                            ],
                          ]),
                        ),
                      if (_cats.isEmpty) const Padding(padding: EdgeInsets.all(48), child: Center(child: Text('Belum ada kategori'))),
                    ]),
                  ),
      );
}
