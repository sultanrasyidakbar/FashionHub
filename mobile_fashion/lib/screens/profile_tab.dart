import 'package:flutter/material.dart';
import '../api.dart';
import '../utils.dart';
import 'auth_screens.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});
  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  Future<void> _editName() async {
    final c = TextEditingController(text: Api.user?['name']);
    final currentContext = context;
    final ok = await showDialog<bool>(
      context: currentContext,
      builder: (_) => AlertDialog(
        title: const Text('Ubah Nama'),
        content: TextField(controller: c, decoration: const InputDecoration(labelText: 'Nama lengkap')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(currentContext, false), child: const Text('Batal')),
          FilledButton(style: FilledButton.styleFrom(minimumSize: const Size(90, 42)), onPressed: () => Navigator.pop(currentContext, true), child: const Text('Simpan')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await Api.updateProfile(c.text.trim());
      if (!mounted) return;
      setState(() {});
      notify(currentContext, 'Nama berhasil diperbarui');
    } on ApiException catch (e) {
      if (!mounted) return;
      notify(currentContext, e.message, error: true);
    }
  }

  Future<void> _changePassword() async {
    final cur = TextEditingController(), nw = TextEditingController(), cf = TextEditingController();
    final currentContext = context;
    final ok = await showDialog<bool>(
      context: currentContext,
      builder: (_) => AlertDialog(
        title: const Text('Ubah Password'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: cur, obscureText: true, decoration: const InputDecoration(labelText: 'Password lama')),
          const SizedBox(height: 10),
          TextField(controller: nw, obscureText: true, decoration: const InputDecoration(labelText: 'Password baru (min. 6)')),
          const SizedBox(height: 10),
          TextField(controller: cf, obscureText: true, decoration: const InputDecoration(labelText: 'Konfirmasi password baru')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(currentContext, false), child: const Text('Batal')),
          FilledButton(style: FilledButton.styleFrom(minimumSize: const Size(90, 42)), onPressed: () => Navigator.pop(currentContext, true), child: const Text('Simpan')),
        ],
      ),
    );
    if (ok != true) return;
    if (nw.text != cf.text) {
      if (!mounted) return;
      notify(currentContext, 'Konfirmasi password tidak sama', error: true);
      return;
    }
    try {
      await Api.changePassword(cur.text, nw.text);
      if (!mounted) return;
      notify(currentContext, 'Password berhasil diubah');
    } on ApiException catch (e) {
      if (!mounted) return;
      notify(currentContext, e.message, error: true);
    }
  }

  Future<void> _logout() async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Keluar?'),
        content: const Text('Anda akan keluar dari akun ini.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Batal')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Colors.red, minimumSize: const Size(90, 42)), onPressed: () => Navigator.pop(context, true), child: const Text('Keluar')),
        ],
      ),
    );
    if (yes != true) return;
    await Api.logout();
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
  }

  Widget _item(IconData icon, String label, VoidCallback onTap) => ListTile(
        leading: Icon(icon, color: kPrimary),
        title: Text(label),
        trailing: const Icon(Icons.chevron_right, color: kMuted),
        onTap: onTap,
      );

  @override
  Widget build(BuildContext context) {
    final name = (Api.user?['name'] ?? '').toString();
    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: cardBox(),
          child: Row(children: [
            CircleAvatar(radius: 30, backgroundColor: kPrimary, child: Text(name.isEmpty ? '?' : name[0].toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold))),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                RoleBadge(Api.user?['role'] ?? ''),
                const SizedBox(height: 4),
                Text(Api.user?['email'] ?? '', style: const TextStyle(color: kMuted, fontSize: 13)),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 14),
        Container(
          decoration: cardBox(),
          clipBehavior: Clip.antiAlias,
          child: Column(children: [
            _item(Icons.badge_outlined, 'Ubah Nama', _editName),
            const Divider(height: 1),
            _item(Icons.lock_outline, 'Ubah Password', _changePassword),
            const Divider(height: 1),
            _item(Icons.info_outline, 'Tentang Aplikasi', () => showAboutDialog(
                  context: context,
                  applicationName: 'FashionHub',
                  applicationVersion: '1.0.0',
                  children: const [Text('Aplikasi manajemen produk dan stok fashion untuk UMKM.')],
                )),
          ]),
        ),
        const SizedBox(height: 18),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), foregroundColor: Colors.red, side: const BorderSide(color: Colors.red), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          onPressed: _logout,
          icon: const Icon(Icons.logout),
          label: const Text('Logout'),
        ),
      ]),
    );
  }
}
