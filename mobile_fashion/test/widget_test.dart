import 'package:flutter_test/flutter_test.dart';

import 'package:mobile_fashion/main.dart';

void main() {
  testWidgets('app loads splash screen', (tester) async {
    await tester.pumpWidget(const FashionHubApp());

    expect(find.text('FashionHub'), findsOneWidget);
  });
}
