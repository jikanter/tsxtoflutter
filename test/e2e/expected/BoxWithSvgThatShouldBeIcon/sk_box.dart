import 'package:flutter/material.dart';

part 'sk_box.g.dart';

class SkBox extends StatelessWidget {
  const SkBox({
    super.key,
    required this.children,
    required this.style,
    required this.dashed,
    required this.fill,
  });

  final Object children;
  final Object style;
  final Object dashed;
  final Object fill;

  @override
  Widget build(BuildContext context) => _$SkBoxBuild(this, context);
}
