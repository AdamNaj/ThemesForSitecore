using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Hosting;
using System.Web.Script.Serialization;
using Sitecore.Configuration;
using Sitecore.Pipelines.HttpRequest;

namespace SitecoreThemes
{
    // httpRequestBegin, after the user is resolved: writes the theme loader (sct.js) into the <head> of Sitecore's
    // own pages and of Experience Editor pages, and saves a user's theme choice. The page engine in sct.js decides
    // which pages are Sitecore surfaces; this only has to offer it every page that might be one.
    public class ThemesProcessor : HttpRequestProcessor
    {
        public const string Base = "/sitecore modules/SitecoreThemes/";
        public const string SavePath = "/sitecore/shell/sitecore-themes/save";
        const string ThemeKey = "SitecoreThemes.Theme";
        const string HueKey = "SitecoreThemes.Hue";
        const string EnvKey = "SitecoreThemes.Environment";
        const string PhaseKey = "SitecoreThemes.Phase";
        static readonly Regex EnvId = new Regex("^(prod|staging|qa|dev|sandbox|local|beta)?$"); // empty: back to the config's
        static readonly Regex PhaseId = new Regex("^(dawn|day|dusk|night)?$"); // empty: Auto, the clock's
        static readonly Regex ThemeId = new Regex("^[a-z0-9]{1,40}$");
        // The loader's cache stamp: sct.js's time on disk, read again every 10 seconds, so files deployed over a running
        // site reach browsers without a restart (the build changes sct.js whenever any file the module serves changes).
        static string stamp;
        static DateTime stampRead;
        static string Stamp()
        {
            var now = DateTime.UtcNow;
            if (stamp == null || now - stampRead > TimeSpan.FromSeconds(10))
            {
                stamp = File.GetLastWriteTimeUtc(HostingEnvironment.MapPath(Base + "sct.js")).Ticks.ToString("x");
                stampRead = now;
            }
            return stamp;
        }

        public override void Process(HttpRequestArgs args)
        {
            var context = args.HttpContext;
            var path = context.Request.Path;
            if (path.Equals(SavePath, StringComparison.OrdinalIgnoreCase))
            {
                Save(context);
                args.AbortPipeline();
                return;
            }
            var pageLike = path.StartsWith("/sitecore", StringComparison.OrdinalIgnoreCase)
                || context.Request.QueryString["sc_mode"] == "edit";
            // ponytail: media and API paths skipped by prefix; anything else that is not text/html passes through the filter untouched
            if (!pageLike || path.StartsWith("/sitecore/api/", StringComparison.OrdinalIgnoreCase)
                || path.StartsWith(Base, StringComparison.OrdinalIgnoreCase)
                || context.Request.Headers["X-Requested-With"] == "XMLHttpRequest")
                return;
            context.Response.Filter = new HeadInjector(context.Response.Filter, context.Response, Tag);
        }

        static string Tag()
        {
            var user = Sitecore.Context.User;
            var signedIn = user != null && user.IsAuthenticated;
            var theme = signedIn ? user.Profile.GetCustomProperty(ThemeKey) : "";
            var hues = signedIn ? user.Profile.GetCustomProperty(HueKey) : null;
            if (theme == "softlight")
            {
                theme = "fjord";
                hues = FromSoftlight(hues);
                user.Profile.SetCustomProperty(ThemeKey, theme);
                user.Profile.SetCustomProperty(HueKey, hues);
                user.Profile.Save();
            }
            var env = signedIn ? user.Profile.GetCustomProperty(EnvKey) : "";
            var version = About.Version.Split('.');
            var cfg = new JavaScriptSerializer().Serialize(new
            {
                @base = Base,
                stamp = Stamp(),
                save = user != null && user.IsAuthenticated ? SavePath : "",
                // ponytail: a config default of softlight gets plain Fjord; the config's own hue still applies
                theme = string.IsNullOrEmpty(theme) ? Settings.GetSetting("SitecoreThemes.DefaultTheme", "native").Replace("softlight", "fjord") : theme,
                version = version[0] + "." + version[1],
                title = Settings.GetSetting("SitecoreThemes.Title", ""),
                tint = Settings.GetSetting("SitecoreThemes.Tint", ""),
                env = string.IsNullOrEmpty(env) ? Settings.GetSetting("SitecoreThemes.Environment", "") : env,
                hue = Hues(hues),
                phase = signedIn ? user.Profile.GetCustomProperty(PhaseKey) : "",
            });
            return "<script src=\"" + HttpUtility.HtmlAttributeEncode(Base + "sct.js?v=" + Stamp())
                + "\" data-sct=\"" + HttpUtility.HtmlAttributeEncode(cfg) + "\"></script>";
        }

        // The user's hues, one per theme ({"fjord":40}); a bare number (saved before hues were per theme, or the
        // config's while the user has none) applies to every theme, and the engine resolves either.
        static object Hues(string saved)
        {
            int hue;
            if (!int.TryParse(saved, out hue))
            {
                var map = ReadHues(saved);
                if (map != null) return map;
                hue = Settings.GetIntSetting("SitecoreThemes.Hue", 0);
            }
            return hue > 0 && hue < 360 ? (int?)hue : null;
        }

        // Softlight was Fjord's light palette turned half way round the colour wheel (settings.js migrateSoftlight):
        // its users get Fjord at that hue plus any hue they had given Softlight. The module has no Light mode, so
        // Fjord follows the OS.
        const int SoftlightHue = 180;
        static string FromSoftlight(string saved)
        {
            var hues = ReadHues(saved) ?? new Dictionary<string, int>();
            int own;
            if (!hues.TryGetValue("softlight", out own) && !int.TryParse(saved, out own)) own = 0;
            hues.Remove("softlight");
            var turned = (SoftlightHue + own) % 360;
            if (turned > 0) hues["fjord"] = turned;
            else hues.Remove("fjord");
            return new JavaScriptSerializer().Serialize(hues);
        }

        static Dictionary<string, int> ReadHues(string saved)
        {
            if (string.IsNullOrEmpty(saved)) return null;
            try { return new JavaScriptSerializer().Deserialize<Dictionary<string, int>>(saved); }
            catch (Exception e) when (e is ArgumentException || e is InvalidOperationException) { return null; }
        }

        // POST any of theme=<id>, hue=<0-359> with hueTheme=<id>, env=<prod|staging|qa|dev|sandbox|local|beta>,
        // phase=<dawn|day|dusk|night> with an X-SCT header, which a cross-site form cannot send.
        static void Save(HttpContextBase context)
        {
            var user = Sitecore.Context.User;
            var theme = context.Request.Form["theme"];
            var hue = context.Request.Form["hue"];
            var hueTheme = context.Request.Form["hueTheme"];
            var env = context.Request.Form["env"];
            var phase = context.Request.Form["phase"];
            int degrees = 0;
            if (context.Request.HttpMethod != "POST" || context.Request.Headers["X-SCT"] != "1"
                || user == null || !user.IsAuthenticated || (theme == null && hue == null && env == null && phase == null)
                || (theme != null && !ThemeId.IsMatch(theme))
                || (hue != null && !(int.TryParse(hue, out degrees) && degrees >= 0 && degrees < 360 && hueTheme != null && ThemeId.IsMatch(hueTheme)))
                || (env != null && !EnvId.IsMatch(env))
                || (phase != null && !PhaseId.IsMatch(phase)))
                context.Response.StatusCode = 400;
            else
            {
                if (theme != null) user.Profile.SetCustomProperty(ThemeKey, theme);
                if (hue != null)
                {
                    var hues = ReadHues(user.Profile.GetCustomProperty(HueKey)) ?? new Dictionary<string, int>();
                    if (degrees > 0) hues[hueTheme] = degrees;
                    else hues.Remove(hueTheme);
                    user.Profile.SetCustomProperty(HueKey, new JavaScriptSerializer().Serialize(hues));
                }
                if (env != null) user.Profile.SetCustomProperty(EnvKey, env);
                if (phase != null) user.Profile.SetCustomProperty(PhaseKey, phase);
                user.Profile.Save();
                context.Response.StatusCode = 204;
            }
            context.ApplicationInstance.CompleteRequest();
        }
    }

    // Holds back an HTML response until its <head ...> tag has passed, then writes the tag right after it
    // (or before <body> when there is no head), so the loader runs before the page's own scripts and styles.
    // Anything that is not a 200 text/html page, or has neither tag in its first Limit bytes, passes through unchanged.
    class HeadInjector : Stream
    {
        const int Limit = 256 * 1024;
        readonly Stream inner;
        readonly HttpResponseBase response;
        readonly Func<string> tag;
        MemoryStream pending = new MemoryStream();

        public HeadInjector(Stream inner, HttpResponseBase response, Func<string> tag)
        {
            this.inner = inner;
            this.response = response;
            this.tag = tag;
        }

        public override void Write(byte[] buffer, int offset, int count)
        {
            if (pending == null)
            {
                inner.Write(buffer, offset, count);
                return;
            }
            pending.Write(buffer, offset, count);
            var at = Find();
            if (at < 0 && IsHtml && pending.Length < Limit) return;
            Release(at);
        }

        bool IsHtml => response.StatusCode == 200 && (response.ContentType ?? "").StartsWith("text/html", StringComparison.OrdinalIgnoreCase);

        int Find() => IsHtml ? InsertAt(pending.GetBuffer(), (int)pending.Length) : -1;

        void Release(int at)
        {
            var bytes = pending.GetBuffer();
            var length = (int)pending.Length;
            pending = null;
            if (at < 0)
            {
                inner.Write(bytes, 0, length);
                return;
            }
            var insert = (response.ContentEncoding ?? Encoding.UTF8).GetBytes(tag());
            inner.Write(bytes, 0, at);
            inner.Write(insert, 0, insert.Length);
            inner.Write(bytes, at, length - at);
        }

        // after the '>' of <head ...>, else at <body, else -1 (ASCII markup reads the same in UTF-8 and single-byte encodings)
        static int InsertAt(byte[] bytes, int length)
        {
            var text = Encoding.ASCII.GetString(bytes, 0, length);
            var head = Regex.Match(text, @"<head(\s[^>]*)?>", RegexOptions.IgnoreCase);
            if (head.Success) return head.Index + head.Length;
            return text.IndexOf("<body", StringComparison.OrdinalIgnoreCase);
        }

        public override void Flush()
        {
            if (pending == null) inner.Flush();
        }

        public override void Close()
        {
            if (pending != null) Release(Find());
            inner.Close();
        }

        public override bool CanRead => false;
        public override bool CanSeek => false;
        public override bool CanWrite => true;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
    }
}
