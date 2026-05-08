import 'package:flutter/material.dart';

part 'stat_badge.g.dart';

class StatBadge extends StatelessWidget {
  const StatBadge({super.key, required this.label, required this.value});

  final String label;
  final num value;

  @override
  Widget build(BuildContext context) => _$StatBadgeBuild(this, context);
}
