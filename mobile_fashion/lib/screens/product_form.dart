import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../api.dart';
import '../utils.dart';

class ProductFormScreen extends StatefulWidget {
  final Map<String, dynamic>? product; // null = tambah baru
  const ProductFormScreen({super.key, this.product});
  @override
  State<ProductFormScreen> createState() => _ProductFormScreenState();
}

class _ProductFormScreenState extends State<ProductFormScreen> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.product?['name']);
  late final _desc = TextEditingController(
    text: widget.product?['description'],
  );
  late final _price = TextEditingController(
    text: widget.product == null
        ? ''
        : '${(widget.product!['price'] as num).round()}',
  );
  late final _stock = TextEditingController(
    text: widget.product == null ? '' : '${widget.product!['stock']}',
  );
  List<Map<String, dynamic>> _cats = [];
  int? _catId;
  XFile? _image;
  Uint8List? _imageBytes;
  bool _saving = false;

  bool get _edit => widget.product != null;

  @override
  void initState() {
    super.initState();
    _catId = widget.product?['category_id'];
    Api.categories()
        .then((c) {
          if (mounted) setState(() => _cats = c);
        })
        .catchError((e) {
          if (mounted) notify(context, '$e', error: true);
        });
  }

  Future<void> _pick(ImageSource src) async {
    final x = await ImagePicker().pickImage(
      source: src,
      maxWidth: 1280,
      imageQuality: 80,
    );
    if (x != null) {
      final bytes = await x.readAsBytes();
      if (mounted) {
        setState(() {
          _image = x;
          _imageBytes = bytes;
        });
      }
    }
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await Api.saveProduct(
        id: widget.product?['id'],
        image: _image,
        fields: {
          'name': _name.text.trim(),
          'description': _desc.text.trim(),
          'price': _price.text.trim(),
          'stock': _stock.text.trim(),
          'category_id': '$_catId',
        },
      );
      notifyDataChanged();
      if (!mounted) return;
      Navigator.pop(context, true);
      notify(
        context,
        _edit ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan',
      );
    } on ApiException catch (e) {
      if (mounted) notify(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final existing = widget.product?['image_url'] as String?;
    return Scaffold(
      appBar: AppBar(title: Text(_edit ? 'Edit Produk' : 'Tambah Produk')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _form,
          child: Column(
            children: [
              GestureDetector(
                onTap: () => showModalBottomSheet(
                  context: context,
                  builder: (_) => SafeArea(
                    child: Wrap(
                      children: [
                        ListTile(
                          leading: const Icon(Icons.photo_library),
                          title: const Text('Pilih dari galeri'),
                          onTap: () {
                            Navigator.pop(context);
                            _pick(ImageSource.gallery);
                          },
                        ),
                        ListTile(
                          leading: const Icon(Icons.photo_camera),
                          title: const Text('Ambil foto'),
                          onTap: () {
                            Navigator.pop(context);
                            _pick(ImageSource.camera);
                          },
                        ),
                      ],
                    ),
                  ),
                ),
                child: Container(
                  height: 240,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE3EAF8),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFB9C9EA)),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: _image != null
                      ? Image.memory(_imageBytes!, fit: BoxFit.contain)
                      : existing != null
                      ? Image.network(existing, fit: BoxFit.contain)
                      : const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.photo_camera_outlined,
                              size: 40,
                              color: kPrimary,
                            ),
                            SizedBox(height: 6),
                            Text(
                              'Upload Gambar',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: kPrimary,
                              ),
                            ),
                            Text(
                              'Pilih dari galeri (JPG/PNG/WEBP, maks. 2 MB)',
                              style: TextStyle(fontSize: 11, color: kMuted),
                            ),
                          ],
                        ),
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(
                  labelText: 'Nama Produk',
                  hintText: 'Contoh: Oversize Hoodie',
                ),
                validator: (v) => (v == null || v.trim().length < 2)
                    ? 'Minimal 2 karakter'
                    : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<int>(
                initialValue: _cats.any((c) => c['id'] == _catId)
                    ? _catId
                    : null,
                decoration: const InputDecoration(labelText: 'Kategori'),
                items: [
                  for (final c in _cats)
                    DropdownMenuItem<int>(
                      value: c['id'],
                      child: Text(c['name']),
                    ),
                ],
                onChanged: (v) => setState(() => _catId = v),
                validator: (v) => v == null ? 'Pilih kategori' : null,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _price,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Harga (Rp)',
                      ),
                      validator: (v) => (double.tryParse(v ?? '') ?? -1) < 0
                          ? 'Angka tidak valid'
                          : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _stock,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Stok'),
                      validator: (v) => (int.tryParse(v ?? '') ?? -1) < 0
                          ? 'Angka tidak valid'
                          : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _desc,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Deskripsi (opsional)',
                ),
              ),
              const SizedBox(height: 22),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Simpan Produk'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
