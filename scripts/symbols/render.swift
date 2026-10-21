// Renders SF Symbols with this Mac's own copy of them, for `npm run symbols`: each as a 3× PNG, black on transparency
// (an alpha mask: the screens tint it with the text's color). Arguments: the output folder, then `name` or
// `name:weight` (ultralight…black). Prints one JSON line per symbol: its name, file and size in points.
import AppKit

let weights: [String: NSFont.Weight] = [
  "ultralight": .ultraLight, "thin": .thin, "light": .light, "regular": .regular, "medium": .medium,
  "semibold": .semibold, "bold": .bold, "heavy": .heavy, "black": .black,
]
let args = Array(CommandLine.arguments.dropFirst())
let out = args[0]
let pointSize: CGFloat = 32
let scale: CGFloat = 3

for spec in args.dropFirst() {
  let parts = spec.split(separator: ":").map(String.init)
  let name = parts[0]
  let weightName = parts.count > 1 ? parts[1] : "regular"
  let config = NSImage.SymbolConfiguration(pointSize: pointSize, weight: weights[weightName] ?? .regular, scale: .medium)
  guard let image = NSImage(systemSymbolName: name, accessibilityDescription: nil)?.withSymbolConfiguration(config) else {
    print("{\"name\":\"\(spec)\",\"missing\":true}")
    continue
  }
  let size = image.size
  guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int((size.width * scale).rounded(.up)), pixelsHigh: Int((size.height * scale).rounded(.up)), bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) else { continue }
  rep.size = size
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  image.draw(in: NSRect(origin: .zero, size: size))
  NSGraphicsContext.restoreGraphicsState()
  let file = weightName == "regular" ? "\(name).png" : "\(name)@\(weightName).png"
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(out)/\(file)"))
  print("{\"name\":\"\(spec)\",\"file\":\"\(file)\",\"w\":\(size.width),\"h\":\(size.height)}")
}
