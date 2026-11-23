import 'package:flutter/material.dart';
import '../api.dart';
import '../utils.dart';
import 'auth_screens.dart';
import 'main_shell.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    final ok = await Api.restore(); // validasi token tersimpan
    await Future.delayed(const Duration(milliseconds: 1200));
    if (!mounted) return;
    Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => ok ? const MainShell() : const LoginScreen()));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Container(
          width: double.infinity,
          decoration: const BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [kPrimaryDark, kPrimary]),
          ),
          child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(Icons.checkroom, size: 96, color: Colors.white),
            SizedBox(height: 12),
            Text('FashionHub', style: TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w800)),
            SizedBox(height: 6),
            Text('Belanja Fashion, Lebih Mudah', style: TextStyle(color: Color(0xCCFFFFFF))),
            SizedBox(height: 40),
            SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)),
          ]),
        ),
      );
}
