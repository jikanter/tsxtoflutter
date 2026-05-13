import 'package:flutter/material.dart';

part 'page_header.g.dart';

class PageHeader extends StatelessWidget {
  const PageHeader({super.key, required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) => _$PageHeaderBuild(this, context);
}
