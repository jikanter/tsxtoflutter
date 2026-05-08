import 'package:flutter/material.dart';

part 'cta.g.dart';

class Cta extends StatelessWidget {
  const Cta({super.key, required this.label, required this.onGo});

  final String label;
  final VoidCallback onGo;

  @override
  Widget build(BuildContext context) => _$CtaBuild(this, context);
}
