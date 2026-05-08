import 'package:flutter/material.dart';

part 'info_card.g.dart';

class InfoCard extends StatelessWidget {
  const InfoCard({super.key, required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => _$InfoCardBuild(this, context);
}
