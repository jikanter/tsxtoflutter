import 'package:flutter/material.dart';

part 'list_row.g.dart';

class ListRow extends StatelessWidget {
  const ListRow({
    super.key,
    required this.title,
    required this.subtitle,
    required this.onPress,
  });

  final String title;
  final String subtitle;
  final VoidCallback onPress;

  @override
  Widget build(BuildContext context) => _$ListRowBuild(this, context);
}
