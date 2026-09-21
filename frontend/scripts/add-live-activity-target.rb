#!/usr/bin/env ruby
# frozen_string_literal: true
#
# add-live-activity-target.rb — wire the two things Xcode's GUI would
# otherwise have to add by hand into an iOS Capacitor project:
#
#   1. App/App/PrivacyInfo.xcprivacy in the App target's Resources phase
#      (a privacy manifest that is not in a build phase is not bundled, and
#      App Store validation then behaves as if it did not exist).
#   2. the `BelaActivity` Widget Extension target that draws the Live
#      Activity / Dynamic Island for a running bela online game — embedded
#      in the app, deployment target 16.2, sharing exactly one source file
#      (BelaActivityAttributes.swift) with the App target, as ActivityKit
#      requires.
#
# IDEMPOTENT: re-running it on an already-patched project changes nothing
# and exits 0. That matters because scripts/create-games-native.sh copies
# ios/ → ios-games/ and then runs this against the copy.
#
# It does NOT build, sign or open anything.
#
# Usage:
#   ruby scripts/add-live-activity-target.rb [path/to/App.xcodeproj]
#
# Default project: frontend/ios/App/App.xcodeproj
#
# Requires the `xcodeproj` gem:
#   gem install --user-install xcodeproj
#   # then, if `ruby -e "require 'xcodeproj'"` fails:
#   export GEM_HOME="$(ruby -e 'puts Gem.user_dir')"

require "fileutils"

begin
  require "xcodeproj"
rescue LoadError
  abort <<~MSG
    ✗ the `xcodeproj` gem is not available to this ruby (#{RUBY_VERSION}).

      gem install --user-install xcodeproj
      export GEM_HOME="$(ruby -e 'puts Gem.user_dir')"
      ruby scripts/add-live-activity-target.rb

    Without it, add the target by hand — the exact Xcode click-steps are in
    docs/BELA-GAMES-NATIVE.md, section "iOS popravci 2026-09-20".
  MSG
end

TARGET_NAME       = "BelaActivity"
EXT_DEPLOY_TARGET = "16.2"
# The one type both targets must compile identically, or a pushed
# content-state stops decoding on the phone with no error anywhere.
SHARED_SOURCE     = "BelaActivityAttributes.swift"

project_path = ARGV[0] || File.expand_path("../ios/App/App.xcodeproj", __dir__)
abort "✗ no project at #{project_path}" unless File.directory?(project_path)

root      = File.dirname(project_path)          # …/ios/App
ext_dir   = File.join(root, TARGET_NAME)        # …/ios/App/BelaActivity
abort "✗ missing #{ext_dir} (the widget sources)" unless File.directory?(ext_dir)

project = Xcodeproj::Project.open(project_path)
app     = project.targets.find { |t| t.name == "App" } or abort "✗ no App target"
changed = false

# Plain `def`s, not endless methods: macOS still ships ruby 2.6 as
# /usr/bin/ruby and `def f = x` is a 3.0 syntax error there.
def say(msg)
  puts("  #{msg}")
end

def step(msg)
  puts("\n▸ #{msg}")
end

app_group = project.main_group["App"] or abort "✗ no App group in the project"

# ───────────────────────────────────────────────────────────────────────────
# 1. PrivacyInfo.xcprivacy → App target resources
# ───────────────────────────────────────────────────────────────────────────
step "App/App/PrivacyInfo.xcprivacy → App target Resources"
privacy_name = "PrivacyInfo.xcprivacy"
unless File.exist?(File.join(root, "App", privacy_name))
  abort "✗ App/#{privacy_name} does not exist — write it before running this"
end

privacy_ref = app_group.files.find { |f| f.path == privacy_name }
privacy_ref ||= begin
  changed = true
  say "added a file reference"
  app_group.new_reference(privacy_name)
end

if app.resources_build_phase.files_references.include?(privacy_ref)
  say "already in the Resources build phase"
else
  app.resources_build_phase.add_file_reference(privacy_ref)
  changed = true
  say "added to the Resources build phase"
end

# ───────────────────────────────────────────────────────────────────────────
# 2. the BelaActivity widget extension target
# ───────────────────────────────────────────────────────────────────────────
step "#{TARGET_NAME} widget extension target"
ext = project.targets.find { |t| t.name == TARGET_NAME }

if ext
  say "target already exists — leaving it alone"
else
  changed = true

  # `app_extension` + the widgetkit extension point in Info.plist is what
  # makes this a Widget Extension; Xcodeproj has no dedicated helper.
  ext = project.new_target(
    :app_extension, TARGET_NAME, :ios, EXT_DEPLOY_TARGET
  )
  say "created target #{TARGET_NAME} (app_extension, iOS #{EXT_DEPLOY_TARGET})"

  ext_group = project.main_group.find_subpath(TARGET_NAME, true)
  ext_group.set_source_tree("<group>")
  ext_group.set_path(TARGET_NAME)

  # Own sources.
  Dir.children(ext_dir).sort.each do |name|
    ref = ext_group.new_reference(name)
    case File.extname(name)
    when ".swift"   then ext.add_file_references([ref])
    when ".xcprivacy" then ext.resources_build_phase.add_file_reference(ref)
    end
  end
  say "added #{TARGET_NAME}/* (sources + its own privacy manifest)"

  # The shared attributes file: SAME file reference, a second build file.
  shared_ref = app_group.files.find { |f| f.path == SHARED_SOURCE }
  abort "✗ App/#{SHARED_SOURCE} is not in the project" unless shared_ref
  ext.add_file_references([shared_ref])
  say "#{SHARED_SOURCE} now compiles into BOTH targets"

  # Build settings. The app's bundle id is read back out of the App target so
  # this keeps working after create-games-native.sh rewrites it.
  app_bundle_id = app.build_configurations.first
                     .build_settings["PRODUCT_BUNDLE_IDENTIFIER"]
  app_release   = app.build_configurations.find { |c| c.name == "Release" } ||
                  app.build_configurations.first

  ext.build_configurations.each do |config|
    s = config.build_settings
    s["PRODUCT_BUNDLE_IDENTIFIER"]   = "#{app_bundle_id}.#{TARGET_NAME}"
    s["PRODUCT_NAME"]                = "$(TARGET_NAME)"
    s["INFOPLIST_FILE"]              = "#{TARGET_NAME}/Info.plist"
    s["IPHONEOS_DEPLOYMENT_TARGET"]  = EXT_DEPLOY_TARGET
    s["TARGETED_DEVICE_FAMILY"]      = "1,2"
    s["SWIFT_VERSION"]               = "5.0"
    s["CODE_SIGN_STYLE"]             = "Automatic"
    s["SKIP_INSTALL"]                = "YES"
    s["GENERATE_INFOPLIST_FILE"]     = "NO"
    # App Store validation rejects an extension whose version strings differ
    # from the host app's, so mirror them rather than inventing new ones.
    s["MARKETING_VERSION"]           = app_release.build_settings["MARKETING_VERSION"]
    s["CURRENT_PROJECT_VERSION"]     = app_release.build_settings["CURRENT_PROJECT_VERSION"]
    s["LD_RUNPATH_SEARCH_PATHS"]     = ["$(inherited)", "@executable_path/Frameworks",
                                        "@executable_path/../../Frameworks"]
    s["SWIFT_EMIT_LOC_STRINGS"]      = "YES"
  end
  say "bundle id → #{app_bundle_id}.#{TARGET_NAME}"

  # Embed into the app and make the app depend on it.
  app.add_dependency(ext)
  embed = app.build_phases.find do |p|
    p.respond_to?(:symbol_dst_subfolder_spec) &&
      p.symbol_dst_subfolder_spec == :plug_ins &&
      p.name == "Embed Foundation Extensions"
  end
  embed ||= begin
    phase = app.new_copy_files_build_phase("Embed Foundation Extensions")
    phase.symbol_dst_subfolder_spec = :plug_ins
    phase.dst_path = ""
    # Extensions must be embedded BEFORE the app is signed; keeping the copy
    # phase last in the list is what Xcode itself does.
    phase
  end
  build_file = embed.add_file_reference(ext.product_reference)
  build_file.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }
  say "embedded in App → PlugIns/"
end

if changed
  project.save
  puts "\n✓ saved #{project_path}"
  puts "  verify:  xcodebuild -list -project #{project_path}"
else
  puts "\n✓ nothing to do — project already patched"
end
