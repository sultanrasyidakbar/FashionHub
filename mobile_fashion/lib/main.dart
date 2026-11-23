import 'package:flutter/material.dart';
import 'screens/splash_tab.dart';
import 'utils.dart';

void main() => runApp(const FashionHubApp());

class FashionHubApp extends StatelessWidget {
  const FashionHubApp({super.key});

  @override
  Widget build(BuildContext context) {
    OutlineInputBorder border(Color c) => OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: c));
    return MaterialApp(
      title: 'FashionHub',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: kPrimary),
        scaffoldBackgroundColor: kBg,
        appBarTheme: const AppBarTheme(backgroundColor: kBg, elevation: 0, scrolledUnderElevation: 0, centerTitle: false,
            titleTextStyle: TextStyle(color: Color(0xFF0F1E3D), fontSize: 20, fontWeight: FontWeight.w700)),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: border(const Color(0xFFD5DEEE)),
          enabledBorder: border(const Color(0xFFD5DEEE)),
          focusedBorder: border(kPrimary),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        navigationBarTheme: const NavigationBarThemeData(backgroundColor: Colors.white, indicatorColor: Color(0xFFDDE8FF)),
      ),
      home: const SplashScreen(),
    );
  }
}
