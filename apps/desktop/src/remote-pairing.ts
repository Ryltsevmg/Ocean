/** Finding a pairing link among the arguments of a protocol launch. */
/**
 * Find a pairing link among process arguments passed to a later launch.
 * @param argv - Command-line arguments of the launch.
 * @returns The first argument that is a pairing link, if any.
 */
export function findPairingArgument(argv: readonly string[]): string | undefined {
  return argv.find(argument => argument.startsWith('ocean://pair'))
}
