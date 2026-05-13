import 'package:flutter/material.dart';

part 'checkmark.g.dart';

class Checkmark extends StatelessWidget {
  const Checkmark({super.key, required this.checked, required this.size});

  final bool checked;
  final num size;

  @override
  Widget build(BuildContext context) => _$CheckmarkBuild(this, context);
}
