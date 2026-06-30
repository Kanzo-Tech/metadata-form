import { Flex, Text } from "@radix-ui/themes";

/** Inline label + control, used by the example pickers in the utility strip. */
export function Field({
  label,
  children,
  size = "2",
}: {
  label: string;
  children: React.ReactNode;
  size?: "1" | "2";
}) {
  return (
    <Flex align="center" gap="2">
      <Text size={size} color="gray" mr="2">
        {label}
      </Text>
      {children}
    </Flex>
  );
}
