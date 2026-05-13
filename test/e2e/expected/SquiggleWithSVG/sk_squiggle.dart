import 'package:flutter/material.dart';

part 'sk_squiggle.g.dart';

class SkSquiggle extends StatelessWidget {
  const SkSquiggle({super.key, required this.w});

  final Object w;

  @override
  Widget build(BuildContext context) => _$SkSquiggleBuild(this, context);
}
