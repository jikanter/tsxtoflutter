// GENERATED CODE - DO NOT MODIFY BY HAND
part of 'list_row.dart';

Widget _$ListRowBuild(ListRow widget, BuildContext context) {
  return FilledButton(
    onPressed: widget.onPress,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 12,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          spacing: 4,
          children: [Text(widget.title), Text(widget.subtitle)],
        ),
        const Icon(Icons.chevron_right, size: 16),
      ],
    ),
  );
}
