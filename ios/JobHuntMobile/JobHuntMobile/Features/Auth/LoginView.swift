import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var appModel: AppModel
    @State private var username = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var isSigningIn = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Keep your job search moving in short, focused sessions.")
                        .font(.title3).foregroundStyle(.secondary)
                }
                Section("Sign in") {
                    TextField("Username or email", text: $username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Password", text: $password)
                    Button { signIn() } label: {
                        if isSigningIn { ProgressView() } else { Text("Sign in") }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(username.isEmpty || password.isEmpty || isSigningIn)
                }
                if let errorMessage { Text(errorMessage).foregroundStyle(.red) }
            }
            .navigationTitle("Job Hunt")
        }
    }

    private func signIn() {
        isSigningIn = true
        errorMessage = nil
        Task {
            do { try await appModel.signIn(username: username, password: password) }
            catch { errorMessage = error.localizedDescription }
            isSigningIn = false
        }
    }
}
