import 'package:flutter/material.dart';

part 'text_field.g.dart';

class TextField extends StatelessWidget {
  const TextField({
    super.key,
    required this.label,
    required this.value,
    required this.onChange,
  });

  final String label;
  final String value;
  final VoidCallback onChange;

  @override
  Widget build(BuildContext context) => _$TextFieldBuild(this, context);
}
