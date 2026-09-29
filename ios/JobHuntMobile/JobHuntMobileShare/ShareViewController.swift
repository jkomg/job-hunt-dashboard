import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        handleShare()
    }

    private func handleShare() {
        let items = extensionContext?.inputItems as? [NSExtensionItem] ?? []
        let providers = items.flatMap { $0.attachments ?? [] }
        let group = DispatchGroup()
        var sharedText = ""
        var sharedURL: URL?

        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.url.identifier) { item, _ in
                    if let url = item as? URL { sharedURL = url }
                    group.leave()
                }
            } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { item, _ in
                    if let text = item as? String { sharedText = text }
                    group.leave()
                }
            }
        }

        group.notify(queue: .main) { [weak self] in
            var components = URLComponents()
            components.scheme = "jobhunt"
            components.host = "capture"
            components.queryItems = [
                URLQueryItem(name: "text", value: sharedText),
                URLQueryItem(name: "url", value: sharedURL?.absoluteString)
            ]
            guard let url = components.url else { self?.extensionContext?.completeRequest(returningItems: nil); return }
            self?.extensionContext?.open(url) { _ in
                self?.extensionContext?.completeRequest(returningItems: nil)
            }
        }
    }
}
