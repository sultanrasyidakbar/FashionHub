import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

class Api {
  // Android emulator reaches the host through 10.0.2.2; web/desktop use localhost.
  // On a physical Android device, replace this with the laptop's LAN IP.
  static String get baseUrl =>
      defaultTargetPlatform == TargetPlatform.android && !kIsWeb
      ? 'http://10.0.2.2:3000'
      : 'http://localhost:3000';

  static String? token;
  static Map<String, dynamic>? user;
  static bool get isAdmin => user?['role'] == 'admin';

  static MediaType? _imageMediaType(XFile image) {
    final mimeType = image.mimeType?.toLowerCase();
    if (mimeType != null && mimeType.isNotEmpty) {
      return switch (mimeType) {
        'image/jpeg' => MediaType('image', 'jpeg'),
        'image/png' => MediaType('image', 'png'),
        'image/webp' => MediaType('image', 'webp'),
        _ => null,
      };
    }

    final extension = image.name.split('.').last.toLowerCase();
    return switch (extension) {
      'jpg' || 'jpeg' => MediaType('image', 'jpeg'),
      'png' => MediaType('image', 'png'),
      'webp' => MediaType('image', 'webp'),
      _ => null,
    };
  }

  static Map<String, String> get _headers => {
    'Accept': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };

  static dynamic _parse(http.Response r) {
    Map<String, dynamic> body;
    try {
      body = jsonDecode(r.body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException('Respons server tidak valid (${r.statusCode})');
    }
    if (r.statusCode >= 400 || body['success'] != true) {
      var msg = (body['message'] ?? 'Terjadi kesalahan').toString();
      final errs = body['errors'];
      if (errs is List && errs.isNotEmpty) {
        msg = errs.map((e) => '• ${e['msg']}').join('\n');
      }
      throw ApiException(msg);
    }
    return body['data'];
  }

  static Future<dynamic> _run(Future<http.Response> Function() call) async {
    try {
      return _parse(await call().timeout(const Duration(seconds: 15)));
    } on SocketException {
      throw ApiException('Tidak dapat terhubung ke server');
    } on TimeoutException {
      throw ApiException('Koneksi ke server timeout');
    } on http.ClientException {
      throw ApiException('Tidak dapat terhubung ke server');
    }
  }

  static Uri _u(String path, [Map<String, String>? q]) =>
      Uri.parse('$baseUrl$path').replace(queryParameters: q);

  // ---------- Session ----------
  static Future<bool> restore() async {
    final p = await SharedPreferences.getInstance();
    token = p.getString('token');
    if (token == null) return false;
    try {
      user = Map<String, dynamic>.from(
        await _run(() => http.get(_u('/api/auth/me'), headers: _headers)),
      );
      return true;
    } on ApiException catch (e) {
      if (e.message.contains('Token') || e.message.contains('Pengguna')) {
        await logout();
      }
      return user != null;
    }
  }

  static Future<void> logout() async {
    final p = await SharedPreferences.getInstance();
    await p.remove('token');
    token = null;
    user = null;
  }

  // ---------- Auth ----------
  static Future<void> login(String email, String password) async {
    final d = await _run(
      () => http.post(
        _u('/api/auth/login'),
        headers: {..._headers, 'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}),
      ),
    );
    token = d['token'];
    user = Map<String, dynamic>.from(d['user']);
    final p = await SharedPreferences.getInstance();
    await p.setString('token', token!);
  }

  static Future<void> register(
    String name,
    String email,
    String password,
  ) async {
    await _run(
      () => http.post(
        _u('/api/auth/register'),
        headers: {..._headers, 'Content-Type': 'application/json'},
        body: jsonEncode({'name': name, 'email': email, 'password': password}),
      ),
    );
  }

  static Future<void> updateProfile(String name) async {
    final d = await _run(
      () => http.put(
        _u('/api/auth/profile'),
        headers: {..._headers, 'Content-Type': 'application/json'},
        body: jsonEncode({'name': name}),
      ),
    );
    user = Map<String, dynamic>.from(d);
  }

  static Future<void> changePassword(String current, String next) => _run(
    () => http.put(
      _u('/api/auth/password'),
      headers: {..._headers, 'Content-Type': 'application/json'},
      body: jsonEncode({'current_password': current, 'new_password': next}),
    ),
  );

  // ---------- Categories ----------
  static Future<List<Map<String, dynamic>>> categories() async {
    final d = await _run(
      () => http.get(_u('/api/categories'), headers: _headers),
    );
    return List<Map<String, dynamic>>.from(d);
  }

  static Future<String> saveCategory({
    int? id,
    required String name,
    String? description,
  }) async {
    final body = jsonEncode({'name': name, 'description': description});
    final h = {..._headers, 'Content-Type': 'application/json'};
    await _run(
      () => id == null
          ? http.post(_u('/api/categories'), headers: h, body: body)
          : http.put(_u('/api/categories/$id'), headers: h, body: body),
    );
    return id == null ? 'Kategori ditambahkan' : 'Kategori diperbarui';
  }

  static Future<void> deleteCategory(int id) =>
      _run(() => http.delete(_u('/api/categories/$id'), headers: _headers));

  // ---------- Products ----------
  static Future<List<Map<String, dynamic>>> products({
    String? search,
    int? categoryId,
  }) async {
    final q = <String, String>{
      if (search != null && search.isNotEmpty) 'search': search,
      if (categoryId != null) 'category_id': '$categoryId',
    };
    final d = await _run(
      () => http.get(_u('/api/products', q), headers: _headers),
    );
    return List<Map<String, dynamic>>.from(d);
  }

  static Future<Map<String, dynamic>> product(int id) async =>
      Map<String, dynamic>.from(
        await _run(() => http.get(_u('/api/products/$id'), headers: _headers)),
      );

  static Future<Map<String, dynamic>> buyProduct(int id) async =>
      Map<String, dynamic>.from(
        await _run(
          () => http.post(_u('/api/products/$id/purchase'), headers: _headers),
        ),
      );

  /// Tambah (id == null) atau ubah produk, dengan gambar opsional (multipart)
  static Future<void> saveProduct({
    int? id,
    required Map<String, String> fields,
    XFile? image,
  }) async {
    await _run(() async {
      final req =
          http.MultipartRequest(
              id == null ? 'POST' : 'PUT',
              _u(id == null ? '/api/products' : '/api/products/$id'),
            )
            ..headers.addAll(_headers)
            ..fields.addAll(fields);
      if (image != null) {
        final contentType = _imageMediaType(image);
        if (contentType == null) {
          throw ApiException('Tipe file harus JPG, PNG, atau WEBP');
        }
        req.files.add(
          http.MultipartFile.fromBytes(
            'image',
            await image.readAsBytes(),
            filename: image.name,
            contentType: contentType,
          ),
        );
      }
      return http.Response.fromStream(await req.send());
    });
  }

  static Future<void> deleteProduct(int id) =>
      _run(() => http.delete(_u('/api/products/$id'), headers: _headers));
}
