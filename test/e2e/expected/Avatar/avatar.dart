import 'package:flutter/material.dart';

part 'avatar.g.dart';

class Avatar extends StatelessWidget {
  const Avatar({super.key, required this.initials});

  final String initials;

  @override
  Widget build(BuildContext context) => _$AvatarBuild(this, context);
}
