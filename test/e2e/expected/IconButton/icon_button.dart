import 'package:flutter/material.dart';

part 'icon_button.g.dart';

class IconButton extends StatelessWidget {
  const IconButton({super.key, required this.onPress});

  final VoidCallback onPress;

  @override
  Widget build(BuildContext context) => _$IconButtonBuild(this, context);
}
