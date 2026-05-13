import 'package:flutter/material.dart';

part 'sk_icon.g.dart';

class SkIcon extends StatelessWidget {
  const SkIcon({super.key, required this.d, required this.size});

  final Object d;
  final Object size;

  @override
  Widget build(BuildContext context) => _$SkIconBuild(this, context);
}
