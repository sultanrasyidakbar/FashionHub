import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

const kPrimary = Color(0xFF2563EB);
const kPrimaryDark = Color(0xFF1E3A8A);
const kBg = Color(0xFFF4F7FC);
const kMuted = Color(0xFF6B7A99);

/// Dinaikkan setiap ada perubahan data (tambah/ubah/hapus) agar semua tab memuat ulang.
final ValueNotifier<int> dataVersion = ValueNotifier<int>(0);
void notifyDataChanged() => dataVersion.value++;

String rupiah(num v) => NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0).format(v);

void notify(BuildContext c, String msg, {bool error = false}) {
  ScaffoldMessenger.of(c)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? Colors.red.shade700 : Colors.green.shade700,
      behavior: SnackBarBehavior.floating,
    ));
}

Future<bool> confirmDialog(BuildContext c, String title, String message) async {
  final r = await showDialog<bool>(
    context: c,
    builder: (_) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Batal')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: Colors.red),
          onPressed: () => Navigator.pop(c, true),
          child: const Text('Hapus'),
        ),
      ],
    ),
  );
  return r ?? false;
}

BoxDecoration cardBox({Color color = Colors.white}) => BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(16),
      boxShadow: const [BoxShadow(color: Color(0x14102A56), blurRadius: 12, offset: Offset(0, 4))],
    );

class ProductImage extends StatelessWidget {
  final String? url;
  final double? height;
  const ProductImage({super.key, this.url, this.height});

  @override
  Widget build(BuildContext context) => Container(
        height: height,
        width: double.infinity,
        color: const Color(0xFFE8EEF9),
        child: url == null
            ? const Icon(Icons.checkroom, size: 40, color: Color(0xFF9DB2D8))
            : Image.network(
                url!,
                fit: BoxFit.contain,
                loadingBuilder: (c, w, p) => p == null ? w : const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                errorBuilder: (context, error, stackTrace) => const Icon(Icons.broken_image, color: Color(0xFF9DB2D8)),
              ),
      );
}

class RoleBadge extends StatelessWidget {
  final String role;
  const RoleBadge(this.role, {super.key});

  @override
  Widget build(BuildContext context) {
    final admin = role == 'admin';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: admin ? kPrimary : const Color(0xFFE3EAF8),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(admin ? 'Admin' : 'User',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: admin ? Colors.white : kPrimaryDark)),
    );
  }
}
